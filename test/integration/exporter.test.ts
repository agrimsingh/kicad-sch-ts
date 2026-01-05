// test/integration/exporter.test.ts

import { PythonCodeGenerator } from "../../src/exporters/python-generator";
import { Schematic } from "../../src";

describe("Python Export", () => {
  describe("PythonCodeGenerator", () => {
    it("should create generator instance", () => {
      const generator = new PythonCodeGenerator();
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(PythonCodeGenerator);
    });

    it("should generate valid Python code", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain("import kicad_sch_api as ksa");
      expect(code).toContain("sch.components.add");
      expect(code).toContain("Device:R");
      expect(code).toContain("R1");
      expect(code).toContain("10k");
    });

    it("should include shebang and docstring", () => {
      const sch = Schematic.create("Test");
      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain("#!/usr/bin/env python3");
      expect(code).toContain('"""');
      expect(code).toContain("Generated");
    });

    it("should generate wire code", () => {
      const sch = Schematic.create("Test");
      sch.wires.add({
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
        ],
      });

      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain("sch.wires.add");
      expect(code).toContain("start=");
      expect(code).toContain("end=");
    });

    it("should generate label code", () => {
      const sch = Schematic.create("Test");
      sch.labels.add({
        text: "TestLabel",
        position: { x: 100, y: 100 },
      });

      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain("sch.labels.add");
      expect(code).toContain("TestLabel");
    });

    it("should include rotation when non-zero", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
        rotation: 90,
      });

      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain("rotation=90");
    });

    it("should use minimal template", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const generator = new PythonCodeGenerator("minimal", true, false);
      const code = generator.generate(sch);

      // Minimal template uses positional args
      expect(code).toContain('"Device:R"');
      expect(code).toContain('"R1"');
    });

    it("should escape special characters in strings", () => {
      const sch = Schematic.create('Test "Quoted"');
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: '10k "precision"',
        position: { x: 100, y: 100 },
      });

      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain('\\"');
    });

    it("should include save path when provided", () => {
      const sch = Schematic.create("Test");
      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch, true, "/output/test.kicad_sch");

      expect(code).toContain("sch.save");
      expect(code).toContain("/output/test.kicad_sch");
    });

    it("should generate from real schematic", () => {
      const sch = Schematic.load(
        "tests/reference_kicad_projects/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );

      const generator = new PythonCodeGenerator();
      const code = generator.generate(sch);

      expect(code).toContain("import kicad_sch_api");
      expect(code.length).toBeGreaterThan(100);
    });
  });
});
