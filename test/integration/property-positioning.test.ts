// test/integration/property-positioning.test.ts

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getPropertyPosition } from "../../src/core/property-positioning";
import { SymbolLibraryCache } from "../../src/library/cache";

describe("Property positioning", () => {
  it("uses fallback offsets when library data is missing", () => {
    const cache = new SymbolLibraryCache();
    cache.setLibraryPaths([]);

    const ref = getPropertyPosition(
      "Device:R",
      "Reference",
      { x: 100, y: 100 },
      0,
      cache
    );
    const value = getPropertyPosition(
      "Device:R",
      "Value",
      { x: 100, y: 100 },
      0,
      cache
    );

    expect(ref.position.x).toBeCloseTo(102.54, 3);
    expect(ref.position.y).toBeCloseTo(98.7299, 3);
    expect(value.position.x).toBeCloseTo(102.54, 3);
    expect(value.position.y).toBeCloseTo(101.2699, 3);
  });

  it("applies rotation transforms for property offsets", () => {
    const cache = new SymbolLibraryCache();
    cache.setLibraryPaths([]);

    const ref = getPropertyPosition(
      "Device:R",
      "Reference",
      { x: 100, y: 100 },
      90,
      cache
    );

    expect(ref.position.x).toBeCloseTo(101.2701, 3);
    expect(ref.position.y).toBeCloseTo(102.54, 3);
    expect(ref.rotation).toBe(90);
  });

  it("prefers symbol library offsets when available", () => {
    const dir = mkdtempSync(join(tmpdir(), "kicad-prop-"));
    const libPath = join(dir, "Prop.kicad_sym");

    const content = `
(kicad_symbol_lib
  (version 20211014)
  (generator "test")
  (symbol "Sample"
    (property "Reference" "U" (at 5 -5 90))
    (property "Value" "Sample" (at 2 3 0))
    (symbol "Sample_0_1"
      (pin input line (at 0 0 0) (length 2.54) (name "IN") (number "1"))
    )
  )
)
`;

    writeFileSync(libPath, content, "utf-8");

    const cache = new SymbolLibraryCache();
    cache.addLibraryPath(dir);

    const ref = getPropertyPosition(
      "Prop:Sample",
      "Reference",
      { x: 10, y: 10 },
      0,
      cache
    );

    expect(ref.position.x).toBeCloseTo(15, 3);
    expect(ref.position.y).toBeCloseTo(5, 3);
    expect(ref.rotation).toBe(90);

    rmSync(dir, { recursive: true, force: true });
  });

  it("matches reference schematics for common symbols", () => {
    const cache = new SymbolLibraryCache();
    cache.setLibraryPaths([]);

    const cases = [
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

    for (const name of cases) {
      const folder = `tests/reference_kicad_projects/property_positioning_${name}`;
      const filename = name === "transistor_bjt" ? "transistor_bjt" : name;
      const sch = require("../../src").Schematic.load(
        `${folder}/${filename}.kicad_sch`
      );

      const component = sch.components.all()[0];
      if (!component) {
        throw new Error(`No component found for ${name}`);
      }

      const refProp = component.data.properties.get("Reference");
      const valProp = component.data.properties.get("Value");
      if (!refProp || !valProp) {
        throw new Error(`Missing properties for ${name}`);
      }

      const ref = getPropertyPosition(
        component.libId,
        "Reference",
        component.position,
        component.rotation,
        cache
      );
      const val = getPropertyPosition(
        component.libId,
        "Value",
        component.position,
        component.rotation,
        cache
      );

      expect(ref.position.x).toBeCloseTo(refProp.position.x, 3);
      expect(ref.position.y).toBeCloseTo(refProp.position.y, 3);
      expect(val.position.x).toBeCloseTo(valProp.position.x, 3);
      expect(val.position.y).toBeCloseTo(valProp.position.y, 3);
    }
  });
});
