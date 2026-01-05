// test/integration/api-ergonomics.test.ts

import { randomUUID } from "crypto";
import {
  Schematic,
  TextJustify,
  TextVerticalJustify,
  HierarchicalLabelShape,
} from "../../src";

describe("API ergonomics", () => {
  it("supports hasProperty on components", () => {
    const sch = Schematic.create("Test");
    const component = sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 10, y: 10 },
    });

    expect(component.hasProperty("Reference")).toBe(true);
    expect(component.hasProperty("Missing")).toBe(false);
  });

  it("supports label justification in add", () => {
    const sch = Schematic.create("Test");
    const label = sch.labels.add({
      text: "SIG",
      position: { x: 10, y: 10 },
      justify: {
        horizontal: TextJustify.RIGHT,
        vertical: TextVerticalJustify.TOP,
      },
    });

    expect(label.effects?.justify?.horizontal).toBe(TextJustify.RIGHT);
    expect(label.effects?.justify?.vertical).toBe(TextVerticalJustify.TOP);
  });

  it("finds and replaces signal names", () => {
    const sch = Schematic.create("Test");
    sch.labels.add({ text: "DATA", position: { x: 10, y: 10 } });

    const sheet = sch.sheets.add({
      position: { x: 0, y: 0 },
      size: { width: 20, height: 10 },
      name: "Child",
      filename: "child.kicad_sch",
    });
    sheet.pins.push({
      uuid: randomUUID(),
      name: "DATA",
      shape: HierarchicalLabelShape.INPUT,
      position: { x: 5, y: 5 },
      rotation: 0,
    });
    sch.sheets.markModified();

    const found = sch.findSignalName("DATA");
    expect(found.labels.length).toBe(1);
    expect(found.sheetPins.length).toBe(1);

    const replaced = sch.replaceSignalName("DATA", "CLK");
    expect(replaced.labelsUpdated).toBe(1);
    expect(replaced.sheetPinsUpdated).toBe(1);

    const after = sch.findSignalName("CLK");
    expect(after.labels.length).toBe(1);
    expect(after.sheetPins.length).toBe(1);
  });
});
