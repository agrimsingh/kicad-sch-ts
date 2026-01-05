// test/integration/cli.test.ts

import { execSync } from "child_process";
import { existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";

describe("CLI End-to-End Tests", () => {
  const testOutput = "/tmp/cli_test_demo.kicad_sch";
  const fixturesPath = join(__dirname, "../fixtures");

  beforeEach(() => {
    if (existsSync(testOutput)) rmSync(testOutput);
  });

  afterEach(() => {
    if (existsSync(testOutput)) rmSync(testOutput);
  });

  it("should show help", () => {
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts --help`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("kicad-sch");
    expect(output).toContain("demo");
    expect(output).toContain("bom");
    expect(output).toContain("erc");
  });

  it("should create a demo schematic", () => {
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts demo -o ${testOutput}`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("Demo schematic created");
    expect(existsSync(testOutput)).toBe(true);

    const content = readFileSync(testOutput, "utf-8");
    expect(content).toContain("kicad_sch");
    expect(content).toContain("Device:R");
  });

  it("should create demo with custom component count", () => {
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts demo -o ${testOutput} -c 3`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("Components: 3");
  });

  it("should run ERC on a schematic", () => {
    const schematicPath = join(fixturesPath, "rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch");
    
    // ERC may exit with error code if there are warnings, so we catch
    try {
      const output = execSync(
        `npx ts-node src/adapters/cli/index.ts erc "${schematicPath}"`,
        {
          encoding: "utf-8",
          cwd: process.cwd(),
        }
      );
      expect(output).toContain("ERC");
    } catch (e: any) {
      // ERC may fail with warnings, but should still contain output
      expect(e.stdout || e.stderr).toContain("ERC");
    }
  });

  it("should list libraries", () => {
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts find-libraries`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("libraries");
  });

  it("should audit BOM properties", () => {
    const schematicPath = join(fixturesPath, "rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch");
    
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts bom "${schematicPath}" -p Footprint`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("Auditing BOM properties");
  });

  it("should export documentation", () => {
    const schematicPath = join(fixturesPath, "rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch");
    
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts export-docs "${schematicPath}" -f markdown`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("Components");
    expect(output).toContain("Reference");
  });

  it("should convert to Python code", () => {
    const schematicPath = join(fixturesPath, "rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch");
    
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts kicad-to-python "${schematicPath}"`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("kicad_sch_api");
    expect(output).toContain("schematic");
  });

  it("should extract netlist", () => {
    const schematicPath = join(fixturesPath, "rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch");
    
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts netlist "${schematicPath}"`,
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );

    expect(output).toContain("net");
  });
});
