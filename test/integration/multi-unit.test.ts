// test/integration/multi-unit.test.ts

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Schematic } from "../../src";
import { SymbolLibraryCache } from "../../src/library/cache";

describe("Multi-unit components", () => {
  it("detects unit count and names from library symbols", () => {
    const dir = mkdtempSync(join(tmpdir(), "kicad-multi-"));
    const libPath = join(dir, "Multi.kicad_sym");

    const content = `
(kicad_symbol_lib
  (version 20211014)
  (generator "test")
  (symbol "OpAmp"
    (property "Reference" "U" (at 0 0 0))
    (property "Value" "OpAmp" (at 0 0 0))
    (symbol "OpAmp_0_1")
    (symbol "OpAmp_1_1"
      (pin input line (at 0 0 0) (length 2.54) (name "IN+" ) (number "1"))
    )
    (symbol "OpAmp_2_1"
      (pin input line (at 0 0 0) (length 2.54) (name "IN-" ) (number "2"))
    )
    (symbol "OpAmp_3_1"
      (pin power_in line (at 0 0 0) (length 2.54) (name "VCC" ) (number "3"))
    )
  )
)
`;

    writeFileSync(libPath, content, "utf-8");

    const cache = new SymbolLibraryCache();
    cache.setLibraryPaths([dir]);

    const symbol = cache.getSymbol("Multi:OpAmp");
    expect(symbol).toBeDefined();
    expect(symbol?.unitCount).toBe(3);
    expect(symbol?.unitNames?.get(1)).toBe("A");
    expect(symbol?.unitNames?.get(2)).toBe("B");
    expect(symbol?.unitNames?.get(3)).toBe("C");

    rmSync(dir, { recursive: true, force: true });
  });

  it("adds all units for multi-unit symbols", () => {
    const dir = mkdtempSync(join(tmpdir(), "kicad-multi-add-"));
    const libPath = join(dir, "Multi.kicad_sym");

    const content = `
(kicad_symbol_lib
  (version 20211014)
  (generator "test")
  (symbol "OpAmp"
    (property "Reference" "U" (at 0 0 0))
    (property "Value" "OpAmp" (at 0 0 0))
    (symbol "OpAmp_1_1"
      (pin input line (at 0 0 0) (length 2.54) (name "IN+" ) (number "1"))
    )
    (symbol "OpAmp_2_1"
      (pin input line (at 0 0 0) (length 2.54) (name "IN-" ) (number "2"))
    )
    (symbol "OpAmp_3_1"
      (pin power_in line (at 0 0 0) (length 2.54) (name "VCC" ) (number "3"))
    )
  )
)
`;

    writeFileSync(libPath, content, "utf-8");

    const cache = new SymbolLibraryCache();
    cache.setLibraryPaths([dir]);

    const sch = Schematic.create("Multi");
    const components = sch.components.addAllUnits(
      {
        libId: "Multi:OpAmp",
        reference: "U1",
        value: "OpAmp",
        position: { x: 10, y: 10 },
      },
      cache
    );

    expect(components.length).toBe(3);
    expect(components.map((c) => c.unit)).toEqual([1, 2, 3]);

    rmSync(dir, { recursive: true, force: true });
  });
});
