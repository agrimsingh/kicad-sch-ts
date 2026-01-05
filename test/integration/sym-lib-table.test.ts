// test/integration/sym-lib-table.test.ts

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SymbolLibraryCache } from "../../src/library/cache";

describe("sym-lib-table parsing", () => {
  it("adds library paths from sym-lib-table entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "kicad-symtab-"));
    const libPath = join(dir, "Custom.kicad_sym");
    const tablePath = join(dir, "sym-lib-table");

    writeFileSync(libPath, "(kicad_symbol_lib (version 20211014))", "utf-8");

    const table = `
(sym_lib_table
  (lib (name "Custom") (type "KiCad") (uri "$(KIPRJMOD)/Custom.kicad_sym") (options "") (descr ""))
)
`;
    writeFileSync(tablePath, table, "utf-8");

    const cache = new SymbolLibraryCache();
    cache.setLibraryPaths([]);
    cache.addSymLibTable(tablePath);

    expect(cache.getLibraryPaths()).toContain(dir);

    rmSync(dir, { recursive: true, force: true });
  });
});
