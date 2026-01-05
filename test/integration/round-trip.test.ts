// test/integration/round-trip.test.ts

import { readFileSync } from "fs";
import { Schematic } from "../../src";

describe("Round-Trip Tests", () => {
  const fixturesDir = "test/fixtures";
  const referenceDir = "tests/reference_kicad_projects";

  // Helper function for round-trip testing
  function testRoundTrip(filepath: string) {
    const original = readFileSync(filepath, "utf-8");
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output.trim()).toBe(original.trim());
  }

  // Test fixtures directory files
  const rotations = ["0deg", "90deg", "180deg", "270deg"];
  rotations.forEach((rot) => {
    it(`should round-trip rotated_resistor_${rot}`, () => {
      testRoundTrip(`${fixturesDir}/rotated_resistor_${rot}/rotated_resistor_${rot}.kicad_sch`);
    });
  });

  it("should round-trip junction", () => {
    testRoundTrip(`${fixturesDir}/junction/junction.kicad_sch`);
  });

  it("should round-trip no_connect", () => {
    testRoundTrip(`${fixturesDir}/no_connect/no_connect.kicad_sch`);
  });

  it("should round-trip label_rotations", () => {
    testRoundTrip(`${fixturesDir}/label_rotations/label_rotations.kicad_sch`);
  });

  it("should round-trip text_rotations", () => {
    testRoundTrip(`${fixturesDir}/text_rotations/text_rotations.kicad_sch`);
  });

  // Reference project files
  it("should round-trip hierarchical_label_rotations", () => {
    testRoundTrip(`${referenceDir}/hierarchical_label_rotations/hierarchical_label_rotations.kicad_sch`);
  });

  it("should round-trip rectangles", () => {
    testRoundTrip(`${referenceDir}/rectangles/rectangles.kicad_sch`);
  });

  it("should round-trip text_box_rotations", () => {
    testRoundTrip(`${referenceDir}/text_box_rotations/text_box_rotations.kicad_sch`);
  });

  it("should round-trip text_effects", () => {
    testRoundTrip(`${referenceDir}/text_effects/text_effects.kicad_sch`);
  });

  it("should round-trip multi_unit_tl072", () => {
    testRoundTrip(`${referenceDir}/multi_unit_tl072/test.kicad_sch`);
  });

  it("should round-trip property_preservation", () => {
    testRoundTrip(`${referenceDir}/property_preservation/test.kicad_sch`);
  });

  // Sheet pins (hierarchical schematics)
  it("should round-trip sheet_pins", () => {
    testRoundTrip(`${referenceDir}/sheet_pins/sheet_pins.kicad_sch`);
  });

  it("should round-trip sheet_pins subsheet", () => {
    testRoundTrip(`${referenceDir}/sheet_pins/subsheet.kicad_sch`);
  });

  // Connectivity / hierarchical power
  it("should round-trip ps2_hierarchical_power", () => {
    testRoundTrip(`${referenceDir}/connectivity/ps2_hierarchical_power/ps2_hierarchical_power.kicad_sch`);
  });

  it("should round-trip ps2_hierarchical_power child_circuit", () => {
    testRoundTrip(`${referenceDir}/connectivity/ps2_hierarchical_power/child_circuit.kicad_sch`);
  });

  // Property positioning for various component types
  const componentTypes = [
    "resistor",
    "capacitor",
    "capacitor_electrolytic",
    "diode",
    "led",
    "inductor",
    "transistor_bjt",
    "op_amp",
    "logic_ic",
    "connector",
  ];

  componentTypes.forEach((type) => {
    const folder = `property_positioning_${type}`;
    const filename = type === "transistor_bjt" ? "transistor_bjt" : type;
    it(`should round-trip ${folder}`, () => {
      testRoundTrip(`${referenceDir}/${folder}/${filename}.kicad_sch`);
    });
  });
});

describe("Component Operations", () => {
  it("should add a component", () => {
    const sch = Schematic.create("Test");

    const component = sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.33, y: 101.6 },
    });

    expect(component.reference).toBe("R1");
    expect(component.value).toBe("10k");
    expect(component.libId).toBe("Device:R");
  });

  it("should modify component properties", () => {
    const sch = Schematic.create("Test");

    const component = sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.33, y: 101.6 },
    });

    component.value = "20k";
    component.setProperty("Tolerance", "1%");

    expect(component.value).toBe("20k");
    expect(component.getProperty("Tolerance")).toBe("1%");
  });
});

describe("Wire Operations", () => {
  it("should add a wire", () => {
    const sch = Schematic.create("Test");

    const wire = sch.wires.add({
      start: { x: 100.33, y: 101.6 },
      end: { x: 106.68, y: 101.6 },
    });

    expect(wire.points).toHaveLength(2);
    expect(wire.points[0]).toEqual({ x: 100.33, y: 101.6 });
  });
});

describe("Label Operations", () => {
  it("should add a local label", () => {
    const sch = Schematic.create("Test");

    const label = sch.labels.add({
      text: "VCC",
      position: { x: 100.33, y: 101.6 },
    });

    expect(label.text).toBe("VCC");
  });
});

describe("Grid Alignment", () => {
  it("should snap to grid", () => {
    const { snapToGrid } = require("../../src/geometry/routing");

    const point = snapToGrid({ x: 100.5, y: 101.3 });
    // 100.5 / 1.27 = 79.13 -> round to 79 -> 79 * 1.27 = 100.33
    // 101.3 / 1.27 = 79.76 -> round to 80 -> 80 * 1.27 = 101.6
    expect(point.x).toBeCloseTo(100.33, 2);
    expect(point.y).toBeCloseTo(101.6, 2);
  });
});
