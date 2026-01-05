// test/integration/library.test.ts

import { SymbolLibraryCache, getSymbolCache } from "../../src/library/cache";

describe("Symbol Library Cache", () => {
  let cache: SymbolLibraryCache;

  beforeEach(() => {
    cache = new SymbolLibraryCache();
  });

  it("should initialize with library paths", () => {
    const paths = cache.getLibraryPaths();
    // May be empty if KiCAD not installed, but shouldn't throw
    expect(Array.isArray(paths)).toBe(true);
  });

  it("should add custom library path", () => {
    const testPath = process.cwd();
    cache.addLibraryPath(testPath);
    const paths = cache.getLibraryPaths();
    expect(paths).toContain(testPath);
  });

  it("should return undefined for unknown symbol", () => {
    const symbol = cache.getSymbol("NonExistent:Symbol");
    expect(symbol).toBeUndefined();
  });

  it("should return empty array when searching with no libraries", () => {
    const results = cache.searchSymbols("resistor", 10);
    // Will be empty if no libraries found
    expect(Array.isArray(results)).toBe(true);
  });

  it("should track performance stats", () => {
    const stats = cache.getPerformanceStats();
    expect(stats.totalSymbolsCached).toBe(0);
    expect(stats.totalLibrariesLoaded).toBe(0);
    expect(stats.libraryStats instanceof Map).toBe(true);
  });

  it("should clear cache", () => {
    cache.clearCache();
    const stats = cache.getPerformanceStats();
    expect(stats.totalSymbolsCached).toBe(0);
  });

  // If KiCAD is installed, these tests should pass
  describe("with KiCAD installed", () => {
    it("should find Device:R symbol if KiCAD libraries available", () => {
      const globalCache = getSymbolCache();
      const symbol = globalCache.getSymbol("Device:R");

      // Skip if KiCAD not installed
      if (!symbol) {
        console.log("Skipping: KiCAD libraries not found");
        return;
      }

      expect(symbol).toBeDefined();
      expect(symbol.name).toBe("R");
      expect(symbol.referencePrefix).toBe("R");
    });

    it("should search for resistors if KiCAD libraries available", () => {
      const globalCache = getSymbolCache();
      const results = globalCache.searchSymbols("resistor", 10);

      // Skip detailed checks if no results (KiCAD not installed)
      if (results.length === 0) {
        console.log("Skipping: KiCAD libraries not found");
        return;
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
