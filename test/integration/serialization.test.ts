// test/integration/serialization.test.ts

import { readFileSync } from "fs";
import {
  Schematic,
  TextJustify,
  TextVerticalJustify,
} from "../../src";

describe("Serialization for in-memory changes", () => {
  const fixturesDir = "test/fixtures";
  const referenceDir = "tests/reference_kicad_projects";

  it("serializes created schematics with components, wires, and label effects", () => {
    const sch = Schematic.create("Test");

    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.33, y: 101.6 },
    });

    sch.wires.add({
      start: { x: 100.33, y: 101.6 },
      end: { x: 106.68, y: 101.6 },
    });

    sch.labels.add({
      text: "VCC",
      position: { x: 90, y: 90 },
      effects: {
        justify: {
          horizontal: TextJustify.LEFT,
          vertical: TextVerticalJustify.BOTTOM,
        },
      },
    });

    const output = sch.format();
    const parsed = Schematic.fromString(output);

    expect(parsed.components.get("R1")).toBeDefined();
    expect(parsed.wires.length).toBe(1);

    const label = parsed.labels.getLocalLabels().find((l) => l.text === "VCC");
    expect(label?.effects?.justify?.horizontal).toBe(TextJustify.LEFT);
    expect(label?.effects?.justify?.vertical).toBe(TextVerticalJustify.BOTTOM);
  });

  it("preserves pin UUIDs and property effects after rebuild", () => {
    const original = readFileSync(
      `${referenceDir}/property_preservation/test.kicad_sch`,
      "utf-8"
    );
    const sch = Schematic.fromString(original);
    const component = sch.components.get("R1");
    expect(component).toBeDefined();

    const originalPins = new Map(component!.data.pins);
    const originalProp = component!.data.properties.get("Tolearnce");

    sch.wires.add({
      start: { x: 10, y: 10 },
      end: { x: 20, y: 10 },
    });
    component!.value = "11k";

    const output = sch.format();
    const parsed = Schematic.fromString(output);
    const parsedComponent = parsed.components.get("R1");

    expect(parsedComponent?.value).toBe("11k");

    for (const [pin, uuid] of originalPins) {
      expect(parsedComponent?.data.pins.get(pin)).toBe(uuid);
    }

    const parsedProp = parsedComponent?.data.properties.get("Tolearnce");
    expect(parsedProp?.effects?.justify?.horizontal).toBe(
      originalProp?.effects?.justify?.horizontal
    );
    expect(parsedProp?.effects?.justify?.vertical).toBe(
      originalProp?.effects?.justify?.vertical
    );
  });

  it("preserves label justification on rebuild", () => {
    const original = readFileSync(
      `${fixturesDir}/label_rotations/label_rotations.kicad_sch`,
      "utf-8"
    );
    const sch = Schematic.fromString(original);

    sch.wires.add({
      start: { x: 10, y: 20 },
      end: { x: 30, y: 20 },
    });

    const output = sch.format();
    const parsed = Schematic.fromString(output);
    const label = parsed.labels.getLocalLabels().find((l) => l.text === "LABEL_0");

    expect(label?.effects?.justify?.horizontal).toBe(TextJustify.LEFT);
    expect(label?.effects?.justify?.vertical).toBe(TextVerticalJustify.BOTTOM);
  });

  it("preserves text effects and component property effects on rebuild", () => {
    const textSource = readFileSync(
      `${referenceDir}/text_rotations/text_rotations.kicad_sch`,
      "utf-8"
    );
    const textSch = Schematic.fromString(textSource);

    textSch.wires.add({
      start: { x: 5, y: 5 },
      end: { x: 15, y: 5 },
    });

    const textOutput = textSch.format();
    const textParsed = Schematic.fromString(textOutput);
    const text = textParsed.texts.all().find((t) => t.text === "TEXT_0");

    expect(text?.effects?.font?.size).toEqual([1.27, 1.27]);
    expect(text?.excludeFromSim).toBe(false);

    const effectsSource = readFileSync(
      `${referenceDir}/text_effects/text_effects.kicad_sch`,
      "utf-8"
    );
    const effectsSch = Schematic.fromString(effectsSource);

    effectsSch.wires.add({
      start: { x: 2, y: 2 },
      end: { x: 8, y: 2 },
    });

    const effectsOutput = effectsSch.format();
    const effectsParsed = Schematic.fromString(effectsOutput);
    const effectsComponent = effectsParsed.components.get("R1");
    const refProp = effectsComponent?.data.properties.get("Reference");

    expect(refProp?.effects?.font?.face).toBe("Arial");
    expect(refProp?.effects?.font?.bold).toBe(true);
    expect(refProp?.effects?.justify?.horizontal).toBe(TextJustify.LEFT);
  });
});
