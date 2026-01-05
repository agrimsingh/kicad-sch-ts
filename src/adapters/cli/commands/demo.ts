// src/adapters/cli/commands/demo.ts

import { Command } from "commander";
import { Schematic } from "../../../core/schematic";
import chalk from "chalk";

export const demoCommand = new Command("demo")
  .description("Create a demo schematic with sample components")
  .option("-o, --output <path>", "Output file path", "demo.kicad_sch")
  .option("-c, --components <count>", "Number of components to add", "5")
  .action(async (options) => {
    console.log(chalk.blue("Creating demo schematic..."));

    const sch = Schematic.create("Demo Schematic");

    const componentCount = parseInt(options.components, 10);
    const gridSize = 1.27;
    const spacing = 20 * gridSize;

    for (let i = 0; i < componentCount; i++) {
      const x = 50 * gridSize + (i % 5) * spacing;
      const y = 50 * gridSize + Math.floor(i / 5) * spacing;

      sch.components.add({
        libId: "Device:R",
        reference: `R${i + 1}`,
        value: `${(i + 1) * 10}k`,
        position: { x, y },
      });
    }

    // Add some wires connecting adjacent resistors
    for (let i = 0; i < componentCount - 1; i++) {
      const x1 = 50 * gridSize + (i % 5) * spacing + 5 * gridSize;
      const y1 = 50 * gridSize + Math.floor(i / 5) * spacing;
      const x2 = 50 * gridSize + ((i + 1) % 5) * spacing - 5 * gridSize;
      const y2 = 50 * gridSize + Math.floor((i + 1) / 5) * spacing;

      if (Math.floor(i / 5) === Math.floor((i + 1) / 5)) {
        sch.wires.add({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
      }
    }

    sch.save(options.output);
    console.log(chalk.green(`✓ Demo schematic created: ${options.output}`));
    console.log(chalk.gray(`  Components: ${componentCount}`));
    console.log(chalk.gray(`  Wires: ${sch.wires.length}`));
  });
