// src/discovery/search-index.ts

import Database from "better-sqlite3";
import { SymbolLibraryCache } from "../library/cache";
import { SymbolDefinition } from "../core/types";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export interface SearchResult {
  lib_id: string;
  name: string;
  library: string;
  description: string;
  keywords: string;
  reference_prefix: string;
  pin_count: number;
  category: string;
  match_score: number;
}

export class ComponentSearchIndex {
  private db: Database.Database;
  private dbPath: string;

  constructor(cacheDir?: string) {
    const dir = cacheDir || path.join(os.homedir(), ".cache", "kicad-sch-ts");
    fs.mkdirSync(dir, { recursive: true });
    this.dbPath = path.join(dir, "search_index.db");
    this.db = new Database(this.dbPath);
    this._initDatabase();
  }

  private _initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS components (
        lib_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        library TEXT NOT NULL,
        description TEXT DEFAULT '',
        keywords TEXT DEFAULT '',
        reference_prefix TEXT DEFAULT 'U',
        pin_count INTEGER DEFAULT 0,
        category TEXT DEFAULT '',
        last_updated REAL DEFAULT 0
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(lib_id, name, description, keywords, content='components', content_rowid='rowid');
      CREATE TRIGGER IF NOT EXISTS components_after_insert AFTER INSERT ON components BEGIN
        INSERT INTO components_fts(rowid, lib_id, name, description, keywords) VALUES (new.rowid, new.lib_id, new.name, new.description, new.keywords);
      END;
    `);
  }

  /**
   * Count pins across all units of a symbol definition.
   */
  private _countPins(symbol: SymbolDefinition): number {
    let count = 0;
    for (const unit of symbol.units.values()) {
      count += unit.pins.length;
    }
    return count;
  }

  /**
   * Rebuild the index from a symbol cache.
   */
  rebuildIndex(
    symbolCache: SymbolLibraryCache,
    progressCallback?: (message: string) => void
  ): number {
    // Get all symbols from the cache by loading all libraries
    const libraryNames = symbolCache.getLibraryNames();
    const symbols: SymbolDefinition[] = [];

    for (const libName of libraryNames) {
      const libSymbols = symbolCache.getLibrarySymbols(libName);
      symbols.push(...libSymbols);
      if (progressCallback) {
        progressCallback(`Loaded ${libSymbols.length} symbols from ${libName}`);
      }
    }

    this.db.exec("DELETE FROM components; DELETE FROM components_fts;");

    const insert = this.db.prepare(
      `INSERT INTO components (lib_id, name, library, description, keywords, reference_prefix, pin_count, category, last_updated)
       VALUES (@lib_id, @name, @library, @description, @keywords, @reference_prefix, @pin_count, @category, @last_updated)`
    );

    const transaction = this.db.transaction((batch: SymbolDefinition[]) => {
      for (const symbol of batch) {
        const data = {
          lib_id: symbol.libId,
          name: symbol.name,
          library: symbol.library,
          description: symbol.description,
          keywords: symbol.keywords,
          reference_prefix: symbol.referencePrefix,
          pin_count: this._countPins(symbol),
          category: this._categorizeComponent(symbol),
          last_updated: Date.now(),
        };
        insert.run(data);
      }
    });

    transaction(symbols);
    return symbols.length;
  }

  /**
   * Search for components using full-text search.
   */
  search(
    query: string,
    library?: string,
    category?: string,
    limit: number = 20
  ): SearchResult[] {
    const ftsQuery = query
      .split(" ")
      .map((term) => `"${term}"*`)
      .join(" ");
    let sql = `
      SELECT c.*, bm25(components_fts) as match_score
      FROM components_fts
      JOIN components c ON c.lib_id = components_fts.lib_id
      WHERE components_fts MATCH ?
    `;
    const params: (string | number)[] = [ftsQuery];

    if (library) {
      sql += " AND c.library = ?";
      params.push(library);
    }
    if (category) {
      sql += " AND c.category = ?";
      params.push(category);
    }

    sql += " ORDER BY match_score LIMIT ?";
    params.push(limit);

    return this.db.prepare(sql).all(params) as SearchResult[];
  }

  /**
   * Get the total number of indexed components.
   */
  getCount(): number {
    const result = this.db.prepare("SELECT COUNT(*) as count FROM components").get() as { count: number };
    return result.count;
  }

  /**
   * Get all unique categories in the index.
   */
  getCategories(): string[] {
    const rows = this.db.prepare("SELECT DISTINCT category FROM components ORDER BY category").all() as { category: string }[];
    return rows.map(r => r.category).filter(Boolean);
  }

  /**
   * Get all unique libraries in the index.
   */
  getLibraries(): string[] {
    const rows = this.db.prepare("SELECT DISTINCT library FROM components ORDER BY library").all() as { library: string }[];
    return rows.map(r => r.library);
  }

  /**
   * Clear the index.
   */
  clear(): void {
    this.db.exec("DELETE FROM components; DELETE FROM components_fts;");
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }

  private _categorizeComponent(symbol: SymbolDefinition): string {
    const prefix = symbol.referencePrefix.toUpperCase();
    if (prefix === "R") return "resistor";
    if (prefix === "C") return "capacitor";
    if (prefix === "L") return "inductor";
    if (prefix === "D" || prefix === "LED") return "diode";
    if (prefix === "Q") return "transistor";
    if (prefix === "U") return "integrated_circuit";
    if (prefix === "J") return "connector";
    return "other";
  }
}
