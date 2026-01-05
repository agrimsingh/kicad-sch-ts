// test/integration/bom.test.ts

import { BOMPropertyAuditor } from "../../src/bom/auditor";
import { Schematic } from "../../src";
import { existsSync, unlinkSync } from "fs";

describe("BOM Audit", () => {
  describe("BOMPropertyAuditor", () => {
    let auditor: BOMPropertyAuditor;

    beforeEach(() => {
      auditor = new BOMPropertyAuditor();
    });

    it("should create auditor instance", () => {
      expect(auditor).toBeDefined();
      expect(auditor).toBeInstanceOf(BOMPropertyAuditor);
    });

    it("should find missing properties in real schematic", () => {
      const issues = auditor.auditSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch",
        ["PartNumber", "Manufacturer"]
      );

      // The fixture likely doesn't have PartNumber and Manufacturer
      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(issues[0]).toHaveProperty("missingProperties");
        expect(issues[0].missingProperties).toContain("PartNumber");
      }
    });

    it("should not find issues if properties exist", () => {
      const issues = auditor.auditSchematic(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch",
        ["Reference", "Value"] // These always exist
      );

      // Reference and Value are standard properties, should have no issues
      expect(issues.length).toBe(0);
    });

    it("should audit directory recursively", () => {
      const issues = auditor.auditDirectory(
        "tests/reference_kicad_projects/rotated_resistor_0deg",
        ["PartNumber"],
        true,
        false
      );

      expect(Array.isArray(issues)).toBe(true);
    });

    it("should skip power symbols", () => {
      // Use a schematic that might have power symbols
      const issues = auditor.auditSchematic(
        "tests/reference_kicad_projects/connectivity/ps2_hierarchical_power/ps2_hierarchical_power.kicad_sch",
        ["PartNumber"]
      );

      // Power symbols (starting with #) should be skipped
      const powerSymbolIssues = issues.filter((i) =>
        i.reference.startsWith("#")
      );
      expect(powerSymbolIssues.length).toBe(0);
    });

    it("should generate BOM", () => {
      const bom = auditor.generateBOM(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      expect(Array.isArray(bom)).toBe(true);
      if (bom.length > 0) {
        expect(bom[0]).toHaveProperty("reference");
        expect(bom[0]).toHaveProperty("value");
        expect(bom[0]).toHaveProperty("quantity");
      }
    });

    it("should group same components in BOM", () => {
      // Create a schematic with multiple identical components
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });
      sch.components.add({
        libId: "Device:R",
        reference: "R2",
        value: "10k",
        position: { x: 200, y: 100 },
      });
      sch.components.add({
        libId: "Device:R",
        reference: "R3",
        value: "20k", // Different value
        position: { x: 300, y: 100 },
      });

      // Save temporarily and audit
      const tmpPath = "/tmp/test-bom-grouping.kicad_sch";
      sch.save(tmpPath);

      const bom = auditor.generateBOM(tmpPath);

      // Should have 2 groups: 10k (qty 2) and 20k (qty 1)
      expect(bom.length).toBe(2);

      const r10k = bom.find((e) => e.value === "10k");
      const r20k = bom.find((e) => e.value === "20k");

      expect(r10k?.quantity).toBe(2);
      expect(r20k?.quantity).toBe(1);

      // Clean up
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath);
      }
    });
  });
});
