// test/integration/round-trip.test.ts

import { readFileSync } from "fs";
import { Schematic } from "../../src";

describe("Round-Trip Tests", () => {
  const fixturesDir = "test/fixtures";

  it("should round-trip rotated_resistor_0deg", () => {
    const filepath = `${fixturesDir}/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch`;
    const original = readFileSync(filepath, "utf-8");
    const sch = Schematic.fromString(original);
    const output = sch.format();
    
    // Compare line by line for better debugging
    const originalLines = original.trim().split("\n");
    const outputLines = output.trim().split("\n");
    
    expect(outputLines.length).toBe(originalLines.length);
    
    for (let i = 0; i < originalLines.length; i++) {
      if (originalLines[i] !== outputLines[i]) {
        console.log(`Line ${i + 1} differs:`);
        console.log(`  Original: "${originalLines[i]}"`);
        console.log(`  Output:   "${outputLines[i]}"`);
      }
      expect(outputLines[i]).toBe(originalLines[i]);
    }
  });

  const rotations = ["0deg", "90deg", "180deg", "270deg"];
  rotations.forEach((rot) => {
    it(`should round-trip rotated_resistor_${rot}`, () => {
      const filepath = `${fixturesDir}/rotated_resistor_${rot}/rotated_resistor_${rot}.kicad_sch`;
      const original = readFileSync(filepath, "utf-8");
      const sch = Schematic.fromString(original);
      const output = sch.format();
      expect(output.trim()).toBe(original.trim());
    });
  });

  it("should round-trip junction", () => {
    const filepath = `${fixturesDir}/junction/junction.kicad_sch`;
    const original = readFileSync(filepath, "utf-8");
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output.trim()).toBe(original.trim());
  });

  it("should round-trip no_connect", () => {
    const filepath = `${fixturesDir}/no_connect/no_connect.kicad_sch`;
    const original = readFileSync(filepath, "utf-8");
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output.trim()).toBe(original.trim());
  });

  it("should round-trip label_rotations", () => {
    const filepath = `${fixturesDir}/label_rotations/label_rotations.kicad_sch`;
    const original = readFileSync(filepath, "utf-8");
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output.trim()).toBe(original.trim());
  });

  it("should round-trip text_rotations", () => {
    const filepath = `${fixturesDir}/text_rotations/text_rotations.kicad_sch`;
    const original = readFileSync(filepath, "utf-8");
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output.trim()).toBe(original.trim());
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
    const { snapToGrid } = require("../../src/core/config");

    const point = snapToGrid({ x: 100.5, y: 101.3 });
    // 100.5 / 1.27 = 79.13 -> round to 79 -> 79 * 1.27 = 100.33
    // 101.3 / 1.27 = 79.76 -> round to 80 -> 80 * 1.27 = 101.6
    expect(point.x).toBeCloseTo(100.33, 2);
    expect(point.y).toBeCloseTo(101.6, 2);
  });
});
