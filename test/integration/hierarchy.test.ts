// test/integration/hierarchy.test.ts

import { HierarchyManager } from "../../src/core/managers/hierarchy";
import { Schematic } from "../../src";

describe("Hierarchy Management", () => {
  describe("HierarchyManager", () => {
    it("should create hierarchy manager", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(HierarchyManager);
    });

    it("should build hierarchy tree", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const tree = manager.buildHierarchyTree();

      expect(tree).toBeDefined();
      expect(tree.path).toBe("/");
      expect(tree.level).toBe(0);
      expect(Array.isArray(tree.children)).toBe(true);
    });

    it("should get all sheets", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const sheets = manager.getAllSheets();

      expect(Array.isArray(sheets)).toBe(true);
      expect(sheets.length).toBeGreaterThanOrEqual(1); // At least root
    });

    it("should get sheet by path", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const root = manager.getSheetByPath("/");

      expect(root).toBeDefined();
      expect(root?.path).toBe("/");
    });

    it("should return undefined for non-existent path", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const sheet = manager.getSheetByPath("/nonexistent/");

      expect(sheet).toBeUndefined();
    });

    it("should get max depth", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const depth = manager.getMaxDepth();

      expect(typeof depth).toBe("number");
      expect(depth).toBeGreaterThanOrEqual(0);
    });

    it("should validate sheet pins on empty schematic", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const validation = manager.validateSheetPins();

      expect(validation).toHaveProperty("valid");
      expect(validation).toHaveProperty("errors");
      expect(validation.valid).toBe(true);
    });

    it("should get all hierarchical labels", () => {
      const sch = Schematic.create("Test");
      const manager = new HierarchyManager(sch);
      const labels = manager.getAllHierarchicalLabels();

      expect(Array.isArray(labels)).toBe(true);
    });

    it("should get all components", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const manager = new HierarchyManager(sch);
      const components = manager.getAllComponents();

      expect(Array.isArray(components)).toBe(true);
      expect(components.length).toBe(1);
      expect(components[0].reference).toBe("R1");
    });

    it("should get total component count", () => {
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
        position: { x: 200, y: 100 },
      });

      const manager = new HierarchyManager(sch);
      const count = manager.getTotalComponentCount();

      expect(count).toBe(2);
    });

    describe("with real hierarchical schematic", () => {
      it("should handle sheet_pins fixture", () => {
        const sch = Schematic.load(
          "tests/reference_kicad_projects/sheet_pins/sheet_pins.kicad_sch"
        );

        const manager = new HierarchyManager(sch);
        const tree = manager.getTree();

        expect(tree).toBeDefined();
        expect(tree.children.length).toBeGreaterThan(0);
      });

      it("should load subsheets when requested", () => {
        const sch = Schematic.load(
          "tests/reference_kicad_projects/sheet_pins/sheet_pins.kicad_sch"
        );

        const manager = new HierarchyManager(sch);
        const tree = manager.buildHierarchyTree(true); // Load subsheets

        expect(tree).toBeDefined();
        // Check if subsheet was loaded
        if (tree.children.length > 0) {
          expect(tree.children[0]).toHaveProperty("schematic");
        }
      });

      it("should handle ps2_hierarchical_power fixture", () => {
        const sch = Schematic.load(
          "tests/reference_kicad_projects/connectivity/ps2_hierarchical_power/ps2_hierarchical_power.kicad_sch"
        );

        const manager = new HierarchyManager(sch);
        const sheets = manager.getAllSheets();

        expect(sheets.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
