// test/integration/discovery.test.ts

import { ComponentSearchIndex } from "../../src/discovery/search-index";
import { SymbolLibraryCache } from "../../src/library/cache";
import * as path from "path";
import * as fs from "fs";

describe("ComponentSearchIndex", () => {
  const cacheDir = path.join(__dirname, "..", ".cache");
  const dbPath = path.join(cacheDir, "search_index.db");
  let index: ComponentSearchIndex;

  beforeEach(() => {
    // Clean up any existing db
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    index = new ComponentSearchIndex(cacheDir);
  });

  afterEach(() => {
    if (index) {
      index.close();
    }
    // Clean up after test
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it("should create a database file", () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("should rebuild the index from a symbol cache", () => {
    const symbolCache = new SymbolLibraryCache();
    // SymbolLibraryCache auto-discovers KiCAD libraries
    // On a machine with KiCAD installed, this will index symbols
    // On a machine without KiCAD, it will be 0
    const count = index.rebuildIndex(symbolCache);
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("should start with zero count", () => {
    expect(index.getCount()).toBe(0);
  });

  it("should return empty categories initially", () => {
    const categories = index.getCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBe(0);
  });

  it("should return empty libraries initially", () => {
    const libraries = index.getLibraries();
    expect(Array.isArray(libraries)).toBe(true);
    expect(libraries.length).toBe(0);
  });

  it("should clear the index", () => {
    index.clear();
    expect(index.getCount()).toBe(0);
  });

  describe("with KiCAD libraries available", () => {
    let symbolCache: SymbolLibraryCache;

    beforeAll(() => {
      symbolCache = new SymbolLibraryCache();
    });

    it("should index Device library symbols if available", () => {
      const libPaths = symbolCache.getLibraryPaths();
      if (libPaths.length === 0) {
        // Skip if no KiCAD libraries available
        return;
      }

      // Try to load just the Device library
      const deviceSymbol = symbolCache.getSymbol("Device:R");
      if (!deviceSymbol) {
        // Device library not available
        return;
      }

      // Now rebuild with Device symbols loaded
      const count = index.rebuildIndex(symbolCache);
      expect(count).toBeGreaterThan(0);
    });

    it("should search for resistors if libraries indexed", () => {
      const libPaths = symbolCache.getLibraryPaths();
      if (libPaths.length === 0) {
        return;
      }

      // Load Device library
      symbolCache.getSymbol("Device:R");
      const count = index.rebuildIndex(symbolCache);

      if (count > 0) {
        const results = index.search("resistor");
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it("should filter search by category", () => {
      const libPaths = symbolCache.getLibraryPaths();
      if (libPaths.length === 0) {
        return;
      }

      symbolCache.getSymbol("Device:R");
      const count = index.rebuildIndex(symbolCache);

      if (count > 0) {
        const results = index.search("R", undefined, "resistor");
        expect(Array.isArray(results)).toBe(true);
        for (const result of results) {
          expect(result.category).toBe("resistor");
        }
      }
    });

    it("should filter search by library", () => {
      const libPaths = symbolCache.getLibraryPaths();
      if (libPaths.length === 0) {
        return;
      }

      symbolCache.getSymbol("Device:R");
      const count = index.rebuildIndex(symbolCache);

      if (count > 0) {
        const results = index.search("R", "Device");
        expect(Array.isArray(results)).toBe(true);
        for (const result of results) {
          expect(result.library).toBe("Device");
        }
      }
    });

    it("should get categories after indexing", () => {
      const libPaths = symbolCache.getLibraryPaths();
      if (libPaths.length === 0) {
        return;
      }

      symbolCache.getSymbol("Device:R");
      symbolCache.getSymbol("Device:C");
      const count = index.rebuildIndex(symbolCache);

      if (count > 0) {
        const categories = index.getCategories();
        expect(categories.length).toBeGreaterThan(0);
      }
    });
  });
});
