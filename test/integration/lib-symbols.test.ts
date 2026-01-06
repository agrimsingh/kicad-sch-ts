// test/integration/lib-symbols.test.ts

import { Schematic } from "../../src";
import { SymbolLibraryCache, getSymbolCache } from "../../src/library/cache";
import { Symbol as SSymbol, SExp } from "../../src/core/parser";

describe("lib_symbols population", () => {
  describe("with manual embedding", () => {
    it("should include manually embedded symbol in lib_symbols", () => {
      const sch = Schematic.create("Test");

      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      // Create a minimal mock symbol S-expression
      const mockSymbolSexp: SExp[] = [
        new SSymbol("symbol"),
        "Device:R",
        [new SSymbol("pin_numbers"), [new SSymbol("hide"), new SSymbol("yes")]],
        [new SSymbol("pin_names"), [new SSymbol("offset"), 0]],
        [
          new SSymbol("property"),
          "Reference",
          "R",
          [new SSymbol("at"), 0, 0, 0],
        ],
      ];

      sch.embedSymbol("Device:R", mockSymbolSexp);

      const output = sch.format();

      // Verify lib_symbols contains Device:R
      expect(output).toContain("(lib_symbols");
      expect(output).toContain('"Device:R"');

      // Verify the embedded symbol properties are present
      expect(output).toContain("pin_numbers");
      expect(output).toContain("pin_names");
    });

    it("should include multiple embedded symbols", () => {
      const sch = Schematic.create("Test");

      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      sch.components.add({
        libId: "Device:C",
        reference: "C1",
        value: "100nF",
        position: { x: 150, y: 100 },
      });

      // Embed both symbols
      sch.embedSymbol("Device:R", [
        new SSymbol("symbol"),
        "Device:R",
        [new SSymbol("property"), "Reference", "R", [new SSymbol("at"), 0, 0, 0]],
      ]);

      sch.embedSymbol("Device:C", [
        new SSymbol("symbol"),
        "Device:C",
        [new SSymbol("property"), "Reference", "C", [new SSymbol("at"), 0, 0, 0]],
      ]);

      const output = sch.format();

      expect(output).toContain('"Device:R"');
      expect(output).toContain('"Device:C"');
    });

    it("should not include symbols that are not used by components", () => {
      const sch = Schematic.create("Test");

      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      // Embed a symbol that's not used
      sch.embedSymbol("Device:C", [
        new SSymbol("symbol"),
        "Device:C",
        [new SSymbol("property"), "Reference", "C", [new SSymbol("at"), 0, 0, 0]],
      ]);

      // Only embed R which IS used
      sch.embedSymbol("Device:R", [
        new SSymbol("symbol"),
        "Device:R",
        [new SSymbol("property"), "Reference", "R", [new SSymbol("at"), 0, 0, 0]],
      ]);

      const output = sch.format();

      // Should contain R (used)
      expect(output).toContain('"Device:R"');
      // Should NOT contain C (not used by any component)
      // Note: the embedding adds it to the map, but buildLibSymbols only includes
      // symbols that are used by components
      expect(output).not.toMatch(/\(symbol "Device:C"/);
    });

    it("should retrieve embedded symbol via getEmbeddedSymbol", () => {
      const sch = Schematic.create("Test");

      const mockSexp: SExp[] = [new SSymbol("symbol"), "Device:R"];
      sch.embedSymbol("Device:R", mockSexp);

      const retrieved = sch.getEmbeddedSymbol("Device:R");
      expect(retrieved).toBe(mockSexp);

      const notFound = sch.getEmbeddedSymbol("Device:C");
      expect(notFound).toBeUndefined();
    });
  });

  describe("with cache lookup", () => {
    it("should set and get cache", () => {
      const sch = Schematic.create("Test");
      const cache = new SymbolLibraryCache();

      expect(sch.getCache()).toBeNull();

      sch.setCache(cache);

      expect(sch.getCache()).toBe(cache);
    });

    it("should populate lib_symbols from cache when available", () => {
      const globalCache = getSymbolCache();
      const symbol = globalCache.getSymbol("Device:R");

      // Skip if KiCAD not installed
      if (!symbol) {
        console.log("Skipping: KiCAD libraries not found");
        return;
      }

      const sch = Schematic.create("Test");
      sch.setCache(globalCache);

      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const output = sch.format();

      // Should contain the symbol definition from cache
      expect(output).toContain("(lib_symbols");
      expect(output).toContain('"Device:R"');
      // Should contain actual symbol content from KiCAD library
      expect(output).toContain("pin passive");
    });

    it("should prefer manual embedding over cache lookup", () => {
      const globalCache = getSymbolCache();
      const symbol = globalCache.getSymbol("Device:R");

      // Even if KiCAD is not installed, test still works with mock
      const sch = Schematic.create("Test");
      sch.setCache(globalCache);

      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      // Embed a custom symbol that takes precedence
      const customMarker = "CUSTOM_EMBEDDED_MARKER";
      sch.embedSymbol("Device:R", [
        new SSymbol("symbol"),
        "Device:R",
        [new SSymbol("property"), "Custom", customMarker, [new SSymbol("at"), 0, 0, 0]],
      ]);

      const output = sch.format();

      // Should contain our custom marker, not the cache version
      expect(output).toContain(customMarker);
    });
  });

  describe("getSymbolSexp in cache", () => {
    it("should return undefined for unknown symbol", () => {
      const cache = new SymbolLibraryCache();
      const sexp = cache.getSymbolSexp("NonExistent:Symbol");
      expect(sexp).toBeUndefined();
    });

    it("should return S-expression with lib_id prefix", () => {
      const globalCache = getSymbolCache();
      const symbol = globalCache.getSymbol("Device:R");

      // Skip if KiCAD not installed
      if (!symbol) {
        console.log("Skipping: KiCAD libraries not found");
        return;
      }

      const sexp = globalCache.getSymbolSexp("Device:R");
      expect(sexp).toBeDefined();
      expect(Array.isArray(sexp)).toBe(true);

      // The symbol name should be the full lib_id
      expect(sexp![1]).toBe("Device:R");
    });
  });

  describe("round-trip with lib_symbols", () => {
    it("should preserve lib_symbols when loading and saving", () => {
      // Load an existing schematic that has lib_symbols
      const sch = Schematic.load("test/fixtures/single_resistor/single_resistor.kicad_sch");

      // Modify something to trigger rebuild
      sch.wires.add({
        start: { x: 10, y: 10 },
        end: { x: 20, y: 10 },
      });

      const output = sch.format();

      // Should still have the original lib_symbols
      expect(output).toContain("(lib_symbols");
      expect(output).toContain('"Device:R"');
      expect(output).toContain("(symbol \"R_0_1\"");
      expect(output).toContain("(symbol \"R_1_1\"");
    });
  });
});
