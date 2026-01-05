// test/integration/discovery.test.ts

import { ComponentSearchIndex } from "../../src/discovery/search-index";
import { Schematic } from "../../src";
import { writeFileSync, unlinkSync, existsSync } from "fs";

describe("Discovery Module", () => {
  describe("ComponentSearchIndex", () => {
    let index: ComponentSearchIndex;

    beforeEach(() => {
      index = new ComponentSearchIndex();
    });

    it("should create index instance", () => {
      expect(index).toBeDefined();
      expect(index).toBeInstanceOf(ComponentSearchIndex);
    });

    it("should start with empty count", () => {
      expect(index.getCount()).toBe(0);
    });

    it("should index a schematic", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      expect(index.getCount()).toBeGreaterThan(0);
    });

    it("should search indexed components", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const results = index.search("R");
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find by reference prefix", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const resistors = index.findByReferencePrefix("R");
      expect(Array.isArray(resistors)).toBe(true);
      expect(resistors.length).toBeGreaterThan(0);
    });

    it("should find by value", () => {
      // Index a real schematic
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      // Search for any value that might be in the resistor schematic
      const allEntries = index.findByReferencePrefix("R");
      if (allEntries.length > 0) {
        const firstValue = allEntries[0].value;
        const results = index.findByValue(firstValue);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it("should find by library", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const libs = index.getLibraries();
      if (libs.length > 0) {
        const results = index.findByLibrary(libs[0]);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it("should clear index", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );
      expect(index.getCount()).toBeGreaterThan(0);

      index.clear();
      expect(index.getCount()).toBe(0);
    });

    it("should get all libraries", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const libs = index.getLibraries();
      expect(Array.isArray(libs)).toBe(true);
    });

    it("should get stats", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const stats = index.getStats();
      expect(stats).toHaveProperty("totalComponents");
      expect(stats).toHaveProperty("uniqueLibraries");
      expect(stats).toHaveProperty("uniqueValues");
    });

    it("should index directory", () => {
      const count = index.indexDirectory(
        "tests/reference_kicad_projects/rotated_resistor_0deg",
        false
      );

      expect(count).toBeGreaterThan(0);
      expect(index.getCount()).toBeGreaterThan(0);
    });

    it("should rank results by score", () => {
      index.indexSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const results = index.search("R1");

      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });
  });
});
