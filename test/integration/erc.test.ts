// test/integration/erc.test.ts

import {
  ElectricalRulesChecker,
  ERCSeverity,
  DEFAULT_ERC_CONFIG,
} from "../../src/validation/erc";
import { Schematic } from "../../src";

describe("ERC", () => {
  it("should pass for a valid simple schematic", () => {
    const sch = Schematic.load(
      "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
    );
    const checker = new ElectricalRulesChecker(sch);
    const result = checker.check();

    expect(result.errorCount).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("should detect duplicate references", () => {
    // Create a schematic with duplicate references
    const sch = Schematic.create("Test");
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });
    sch.components.add({
      libId: "Device:R",
      reference: "R1", // Duplicate!
      value: "20k",
      position: { x: 150, y: 100 },
    });

    const checker = new ElectricalRulesChecker(sch, {
      checkDuplicateReferences: true,
    });
    const result = checker.check();

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
    expect(checker.hasViolation(result, "DUPLICATE_REFERENCE")).toBe(true);
  });

  it("should detect off-grid components", () => {
    const sch = Schematic.create("Test");
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.5, y: 100.5 }, // Off-grid
    });

    const checker = new ElectricalRulesChecker(sch, {
      checkOffGridPins: true,
    });
    const result = checker.check();

    expect(result.warningCount).toBeGreaterThan(0);
    expect(checker.hasViolation(result, "OFF_GRID")).toBe(true);
  });

  it("should respect treatWarningsAsErrors config", () => {
    const sch = Schematic.create("Test");
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.5, y: 100.5 }, // Off-grid
    });

    const checker = new ElectricalRulesChecker(sch, {
      treatWarningsAsErrors: true,
    });
    const result = checker.check();

    expect(result.passed).toBe(false);
  });

  it("should provide summary string", () => {
    const sch = Schematic.create("Test");
    const checker = new ElectricalRulesChecker(sch);
    const result = checker.check();
    const summary = checker.getSummary(result);

    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("should filter violations by severity", () => {
    const sch = Schematic.create("Test");
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.5, y: 100.5 },
    });
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "20k",
      position: { x: 150.5, y: 150.5 },
    });

    const checker = new ElectricalRulesChecker(sch);
    const result = checker.check();

    const errors = checker.getViolationsBySeverity(result, ERCSeverity.ERROR);
    const warnings = checker.getViolationsBySeverity(
      result,
      ERCSeverity.WARNING
    );

    expect(errors.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should skip power symbols in duplicate check", () => {
    const sch = Schematic.create("Test");
    // Power symbols start with #
    sch.components.add({
      libId: "power:GND",
      reference: "#PWR01",
      value: "GND",
      position: { x: 100, y: 100 },
    });
    sch.components.add({
      libId: "power:GND",
      reference: "#PWR02",
      value: "GND",
      position: { x: 150, y: 100 },
    });

    const checker = new ElectricalRulesChecker(sch);
    const result = checker.check();

    expect(checker.hasViolation(result, "DUPLICATE_REFERENCE")).toBe(false);
  });
});
