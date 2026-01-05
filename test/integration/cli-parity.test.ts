// test/integration/cli-parity.test.ts

import { execSync } from "child_process";

describe("CLI parity", () => {
  it("exposes the expected command set", () => {
    const output = execSync(
      "npx ts-node src/adapters/cli/index.ts --help",
      { encoding: "utf-8" }
    );

    const commands = [
      "demo",
      "bom",
      "bom-manage",
      "erc",
      "netlist",
      "find-libraries",
      "kicad-to-python",
      "export-docs",
      "mcp",
    ];

    for (const command of commands) {
      expect(output).toContain(command);
    }
  });
});
