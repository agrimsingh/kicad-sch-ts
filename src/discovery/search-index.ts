// src/discovery/search-index.ts

import { Component } from "../core/collections/component";
import { Schematic } from "../core/schematic";
import { readdirSync, existsSync } from "fs";
import { join } from "path";

export interface SearchResult {
  type: "component" | "wire" | "label" | "sheet";
  schematicPath: string;
  reference?: string;
  value?: string;
  libId?: string;
  position?: { x: number; y: number };
  score: number;
}

export interface IndexEntry {
  path: string;
  reference: string;
  value: string;
  libId: string;
  footprint: string;
  keywords: string[];
}

/**
 * Simple in-memory search index for component discovery.
 * 
 * Note: The Python version uses SQLite. This is a simplified in-memory version.
 * For large projects, consider adding better-sqlite3 for persistence.
 */
export class ComponentSearchIndex {
  private entries: IndexEntry[] = [];

  /**
   * Index a schematic and all its components.
   */
  indexSchematic(schematicPath: string): void {
    try {
      const sch = Schematic.load(schematicPath);

      for (const component of sch.components) {
        // Skip power symbols
        if (component.reference.startsWith("#")) continue;

        this.entries.push({
          path: schematicPath,
          reference: component.reference,
          value: component.value,
          libId: component.libId,
          footprint: component.footprint || "",
          keywords: this.extractKeywords(component),
        });
      }
    } catch (e) {
      console.error(`Failed to index ${schematicPath}:`, e);
    }
  }

  /**
   * Index all schematics in a directory.
   */
  indexDirectory(directory: string, recursive: boolean = true): number {
    let count = 0;
    const files = this.findSchematicFiles(directory, recursive);

    for (const file of files) {
      this.indexSchematic(file);
      count++;
    }

    return count;
  }

  private findSchematicFiles(directory: string, recursive: boolean): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isFile() && entry.name.endsWith(".kicad_sch")) {
          files.push(fullPath);
        } else if (recursive && entry.isDirectory()) {
          files.push(...this.findSchematicFiles(fullPath, recursive));
        }
      }
    } catch {
      // Directory not readable
    }

    return files;
  }

  private extractKeywords(component: Component): string[] {
    const keywords: string[] = [];

    // Extract prefix from reference (R1 -> R)
    const refPrefix = component.reference.replace(/[0-9]/g, "");
    if (refPrefix) keywords.push(refPrefix.toLowerCase());

    // Add value words
    const valueWords = component.value
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter((w) => w.length > 0);
    keywords.push(...valueWords);

    // Add lib name
    const libParts = component.libId.split(":");
    if (libParts[0]) keywords.push(libParts[0].toLowerCase());
    if (libParts[1]) keywords.push(libParts[1].toLowerCase());

    return [...new Set(keywords)];
  }

  /**
   * Search for components matching query.
   */
  search(query: string, limit: number = 50): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);

    const results: SearchResult[] = [];

    for (const entry of this.entries) {
      let score = 0;

      // Reference match (highest priority)
      if (entry.reference.toLowerCase().includes(queryLower)) {
        score += 100;
      }

      // Value match
      if (entry.value.toLowerCase().includes(queryLower)) {
        score += 50;
      }

      // LibId match
      if (entry.libId.toLowerCase().includes(queryLower)) {
        score += 30;
      }

      // Footprint match
      if (entry.footprint.toLowerCase().includes(queryLower)) {
        score += 20;
      }

      // Keyword matches
      for (const word of queryWords) {
        if (entry.keywords.some((k) => k.includes(word))) {
          score += 10;
        }
      }

      if (score > 0) {
        results.push({
          type: "component",
          schematicPath: entry.path,
          reference: entry.reference,
          value: entry.value,
          libId: entry.libId,
          score,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Find components by reference prefix (e.g., "R" for resistors).
   */
  findByReferencePrefix(prefix: string): IndexEntry[] {
    const prefixLower = prefix.toLowerCase();
    return this.entries.filter((e) =>
      e.reference.toLowerCase().startsWith(prefixLower)
    );
  }

  /**
   * Find components by value.
   */
  findByValue(value: string): IndexEntry[] {
    const valueLower = value.toLowerCase();
    return this.entries.filter((e) =>
      e.value.toLowerCase().includes(valueLower)
    );
  }

  /**
   * Find components by library.
   */
  findByLibrary(libraryName: string): IndexEntry[] {
    return this.entries.filter((e) => e.libId.startsWith(libraryName + ":"));
  }

  /**
   * Get total number of indexed components.
   */
  getCount(): number {
    return this.entries.length;
  }

  /**
   * Clear the index.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get all unique libraries in the index.
   */
  getLibraries(): string[] {
    const libs = new Set<string>();
    for (const entry of this.entries) {
      const [lib] = entry.libId.split(":");
      if (lib) libs.add(lib);
    }
    return Array.from(libs).sort();
  }

  /**
   * Get statistics about the index.
   */
  getStats(): {
    totalComponents: number;
    uniqueLibraries: number;
    uniqueValues: number;
  } {
    const values = new Set(this.entries.map((e) => e.value));
    const libs = new Set(
      this.entries.map((e) => e.libId.split(":")[0]).filter(Boolean)
    );

    return {
      totalComponents: this.entries.length,
      uniqueLibraries: libs.size,
      uniqueValues: values.size,
    };
  }
}
