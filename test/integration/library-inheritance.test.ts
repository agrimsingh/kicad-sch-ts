// test/integration/library-inheritance.test.ts

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SymbolLibraryCache } from "../../src/library/cache";

describe("Symbol inheritance and pin enumeration", () => {
  it("resolves inherited symbols and lists pins", () => {
    const dir = mkdtempSync(join(tmpdir(), "kicad-lib-"));
    const libPath = join(dir, "Test.kicad_sym");

    const content = `
(kicad_symbol_lib
  (version 20211014)
  (generator "test")
  (symbol "Base"
    (property "Reference" "U" (at 0 0 0))
    (property "Value" "Base" (at 0 0 0))
    (symbol "Base_0_1"
      (pin input line (at 0 0 0) (length 2.54) (name "IN") (number "1"))
    )
  )
  (symbol "Derived"
    (extends "Base")
    (property "Value" "Derived" (at 0 0 0))
  )
  (symbol "Broken"
    (extends "MissingBase")
  )
  (symbol "CycleA"
    (extends "CycleB")
  )
  (symbol "CycleB"
    (extends "CycleA")
  )
)
`;

    writeFileSync(libPath, content, "utf-8");

    const cache = new SymbolLibraryCache();
    cache.addLibraryPath(dir);

    const derived = cache.getSymbol("Test:Derived");
    expect(derived).toBeDefined();
    expect(derived?.units.size).toBeGreaterThan(0);

    const pins = cache.listPins("Test:Derived");
    expect(pins.length).toBe(1);
    expect(cache.showPins("Test:Derived")).toContain("1:IN");

    const brokenErrors = cache.validateInheritanceChain("Test:Broken");
    expect(brokenErrors.length).toBeGreaterThan(0);

    const cycleErrors = cache.validateInheritanceChain("Test:CycleA");
    expect(cycleErrors.length).toBeGreaterThan(0);

    rmSync(dir, { recursive: true, force: true });
  });
});
