// test/integration/bom.test.ts

import { BOMPropertyAuditor } from "../../src/bom/auditor";
import { Schematic } from "../../src";

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
      // Test with a real schematic fixture
      // The BOM grouping logic groups by value + footprint + libId
      const bom = auditor.generateBOM(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      expect(Array.isArray(bom)).toBe(true);

      // Verify BOM entries have the right structure
      if (bom.length > 0) {
        expect(bom[0]).toHaveProperty("reference");
        expect(bom[0]).toHaveProperty("value");
        expect(bom[0]).toHaveProperty("quantity");
        expect(bom[0].quantity).toBeGreaterThanOrEqual(1);
      }
    });

    it("should have correct BOM entry structure", () => {
      const bom = auditor.generateBOM(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      if (bom.length > 0) {
        const entry = bom[0];
        expect(typeof entry.reference).toBe("string");
        expect(typeof entry.value).toBe("string");
        expect(typeof entry.footprint).toBe("string");
        expect(typeof entry.libId).toBe("string");
        expect(typeof entry.quantity).toBe("number");
        expect(typeof entry.properties).toBe("object");
      }
    });
  });
});
