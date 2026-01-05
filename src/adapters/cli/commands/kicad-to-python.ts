// src/adapters/cli/commands/kicad-to-python.ts

import { Command } from "commander";
import { writeFileSync } from "fs";
import { Schematic } from "../../../core/schematic";
import { PythonCodeGenerator } from "../../../exporters/python-generator";
import chalk from "chalk";

export const kicadToPythonCommand = new Command("kicad-to-python")
  .description("Convert a KiCAD schematic to Python code")
  .argument("<input>", "Input schematic file")
  .option("-o, --output <path>", "Output Python file")
  .option(
    "-t, --template <type>",
    "Template type (minimal, default, verbose, documented)",
    "default"
  )
  .action(async (input, options) => {
    console.log(chalk.blue(`Converting: ${input}`));

    const sch = Schematic.load(input);
    const generator = new PythonCodeGenerator(options.template);
    const code = generator.generate(sch, true, options.output);

    if (options.output) {
      writeFileSync(options.output, code);
      console.log(chalk.green(`✓ Python code saved to: ${options.output}`));
    } else {
      console.log(code);
    }
  });
