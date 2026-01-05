---
task: "Port kicad-sch-api to TypeScript - Part 2.6: Final Touches"
test_command: "npm test"
completion_criteria:
  - The `search-index.ts` module is updated to use `better-sqlite3`.
  - The `hierarchy.ts` module has a complete `flattenHierarchy` implementation.
  - All tests pass, including new tests for search and hierarchy.
max_iterations: 150
---

# Task: Port `kicad-sch-api` to TypeScript - Part 2.6: Final Touches

This document provides the final implementation details for the `search-index.ts` and `hierarchy.ts` modules.

---

## 1. Update `src/discovery/search-index.ts`

**Instructions:** Overwrite the existing in-memory implementation with this full SQLite version.

**Run `npm install better-sqlite3` and `npm install --save-dev @types/better-sqlite3` first.**

```typescript
// src/discovery/search-index.ts

import Database from "better-sqlite3";
import { SymbolLibraryCache, SymbolDefinition } from "../library/cache";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

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
                description TEXT DEFAULT 	,
                keywords TEXT DEFAULT 	,
                reference_prefix TEXT DEFAULT 'U',
                pin_count INTEGER DEFAULT 0,
                category TEXT DEFAULT 	,
                last_updated REAL DEFAULT 0
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(lib_id, name, description, keywords, content='components', content_rowid='rowid');
            CREATE TRIGGER IF NOT EXISTS components_after_insert AFTER INSERT ON components BEGIN
                INSERT INTO components_fts(rowid, lib_id, name, description, keywords) VALUES (new.rowid, new.lib_id, new.name, new.description, new.keywords);
            END;
        `);
  }

  rebuildIndex(
    symbolCache: SymbolLibraryCache,
    progressCallback?: (message: string) => void
  ): number {
    const symbols = symbolCache.getAllSymbols();
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
          pin_count: symbol.pins.length,
          category: this._categorizeComponent(symbol),
          last_updated: Date.now(),
        };
        insert.run(data);
      }
    });

    transaction(symbols);
    return symbols.length;
  }

  search(
    query: string,
    library?: string,
    category?: string,
    limit: number = 20
  ): any[] {
    const ftsQuery = query
      .split(" ")
      .map((term) => `"${term}"*`)
      .join(" ");
    let sql = `
            SELECT c.*, fts.rank as match_score
            FROM components_fts fts
            JOIN components c ON c.lib_id = fts.lib_id
            WHERE fts MATCH ?
        `;
    const params: any[] = [ftsQuery];

    if (library) {
      sql += " AND c.library = ?";
      params.push(library);
    }
    if (category) {
      sql += " AND c.category = ?";
      params.push(category);
    }

    sql += " ORDER BY fts.rank LIMIT ?";
    params.push(limit);

    return this.db.prepare(sql).all(params);
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
```

---

## 2. Update `src/core/managers/hierarchy.ts`

**Instructions:** Overwrite the existing simplified file with this complete implementation.

```typescript
// src/core/managers/hierarchy.ts

import { existsSync } from "fs";
import { dirname, resolve, basename } from "path";
import { Schematic } from "../schematic";
import {
  Sheet,
  SheetPin,
  HierarchicalLabel,
  HierarchyNode,
  Point,
  Wire,
  Label,
  Junction,
} from "../types";
import { HierarchyError } from "../exceptions";
import { BaseManager } from "./base";

export class HierarchyManager extends BaseManager {
  private _hierarchyTree: HierarchyNode | null = null;
  private _loadedSchematics: Map<string, Schematic> = new Map();

  constructor(schematic: Schematic) {
    super(schematic.data);
    this._loadedSchematics.set("/", schematic);
  }

  buildHierarchyTree(loadSubsheets: boolean = true): HierarchyNode {
    const rootSchematic = this._loadedSchematics.get("/")!;
    const rootPath = rootSchematic.fileIO?.getFilePath() || "";
    const rootNode: HierarchyNode = {
      path: "/",
      name: rootSchematic.title || basename(rootPath, ".kicad_sch"),
      filename: rootPath,
      schematic: rootSchematic,
      children: [],
      sheetPins: [],
      level: 0,
    };
    this._hierarchyTree = rootNode;
    if (loadSubsheets) {
      this._buildTreeRecursive(rootNode);
    }
    return rootNode;
  }

  private _buildTreeRecursive(node: HierarchyNode): void {
    const schematic = node.schematic;
    if (!schematic) return;

    const baseDir = dirname(node.filename);

    for (const sheet of schematic.sheets) {
      const childFilename = sheet.filename.value;
      const childPath = resolve(baseDir, childFilename);

      const childNode: HierarchyNode = {
        path: `${node.path}${sheet.uuid}/`,
        name: sheet.name.value,
        filename: childPath,
        children: [],
        parent: node,
        sheetPins: [...sheet.pins],
        level: node.level + 1,
      };

      if (existsSync(childPath)) {
        try {
          const childSchematic =
            this._loadedSchematics.get(childPath) || Schematic.load(childPath);
          this._loadedSchematics.set(childPath, childSchematic);
          childNode.schematic = childSchematic;
          this._buildTreeRecursive(childNode);
        } catch (e) {
          console.error(`Failed to load subsheet ${childPath}:`, e);
        }
      }
      node.children.push(childNode);
    }
  }

  flattenHierarchy(prefixReferences: boolean = true): Schematic {
    if (!this._hierarchyTree) this.buildHierarchyTree(true);

    const flatSchematic = new Schematic();

    this._flattenRecursive(
      this._hierarchyTree!,
      flatSchematic,
      prefixReferences,
      ""
    );
    return flatSchematic;
  }

  private _flattenRecursive(
    node: HierarchyNode,
    flatSchematic: Schematic,
    prefixReferences: boolean,
    prefix: string
  ): void {
    if (!node.schematic) return;

    const transformPoint = (p: Point, sheet: Sheet): Point => {
      return { x: p.x + sheet.position.x, y: p.y + sheet.position.y };
    };

    for (const component of node.schematic.components) {
      const newRef =
        prefixReferences && node.parent
          ? `${prefix}${component.reference}`
          : component.reference;
      if (flatSchematic.components.has(newRef)) continue;

      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(component.position, sheetInstance)
        : component.position;

      flatSchematic.components.add(
        component.data,
        newRef,
        pos,
        component.rotation,
        component.mirror
      );
    }

    for (const wire of node.schematic.wires) {
      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const points = sheetInstance
        ? wire.points.map((p) => transformPoint(p, sheetInstance))
        : wire.points;
      flatSchematic.wires.add(points, wire.stroke);
    }

    for (const label of node.schematic.labels) {
      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(label.position, sheetInstance)
        : label.position;
      flatSchematic.labels.add(label.text, pos, label.rotation, label.effects);
    }

    for (const junction of node.schematic.junctions) {
      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(junction.position, sheetInstance)
        : junction.position;
      flatSchematic.junctions.add(pos, junction.diameter, junction.color);
    }

    for (const child of node.children) {
      const sheet = node.schematic.sheets.find(
        (s) => s.name.value === child.name
      );
      if (sheet) {
        const childPrefix = prefixReferences
          ? `${prefix}${sheet.name.value}/`
          : prefix;
        this._flattenRecursive(
          child,
          flatSchematic,
          prefixReferences,
          childPrefix
        );
      }
    }
  }

  // ... (keep other methods)
}
```

---

## 3. Create `test/integration/discovery.test.ts`

**Instructions:** Create a new test file for the search index.

```typescript
// test/integration/discovery.test.ts

import { ComponentSearchIndex } from "../../src/discovery/search-index";
import { SymbolLibraryCache } from "../../src/library/cache";
import * as path from "path";
import * as fs from "fs";

describe("ComponentSearchIndex", () => {
  const cacheDir = path.join(__dirname, "..", ".cache");
  const dbPath = path.join(cacheDir, "search_index.db");

  beforeEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it("should create a database file", () => {
    const index = new ComponentSearchIndex(cacheDir);
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("should rebuild the index from a symbol cache", () => {
    const symbolCache = new SymbolLibraryCache();
    // You would need to load some symbols into the cache here
    // For now, we'll test with an empty cache
    const index = new ComponentSearchIndex(cacheDir);
    const count = index.rebuildIndex(symbolCache);
    expect(count).toBe(0);
  });
});
```

---

## Agent Instructions

1.  **Install Dependencies:** Run `npm install better-sqlite3` and `npm install --save-dev @types/better-sqlite3`.
2.  **Update Files:** Overwrite `src/discovery/search-index.ts` and `src/core/managers/hierarchy.ts` with the provided code.
3.  **Add New Test:** Create the new test file `test/integration/discovery.test.ts`.
4.  **Run `npm test`** and ensure all tests pass.
5.  When complete, output `✅ PART 2.6 COMPLETE`.
