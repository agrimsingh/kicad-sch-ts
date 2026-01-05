// src/adapters/cli/commands/netlist.ts

import { Command } from "commander";
import { Schematic } from "../../../core/schematic";
import { ConnectivityAnalyzer } from "../../../connectivity/analyzer";
import chalk from "chalk";

export const netlistCommand = new Command("netlist")
  .description("Extract netlist from a schematic")
  .argument("<path>", "Schematic file to analyze")
  .option("-o, --output <path>", "Output file path")
  .option("-f, --format <type>", "Output format (json, text)", "text")
  .action(async (path, options) => {
    console.log(chalk.blue(`Extracting netlist from: ${path}`));

    const sch = Schematic.load(path);
    const analyzer = new ConnectivityAnalyzer(sch);
    const nets = analyzer.analyzeNets();

    if (options.format === "json") {
      const output = JSON.stringify(nets, null, 2);
      if (options.output) {
        const { writeFileSync } = await import("fs");
        writeFileSync(options.output, output);
        console.log(chalk.green(`✓ Netlist saved to: ${options.output}`));
      } else {
        console.log(output);
      }
    } else {
      console.log(chalk.green(`Found ${nets.length} nets:`));
      for (const net of nets) {
        console.log(chalk.cyan(`  Net "${net.name}":`));
        for (const pin of net.pins.slice(0, 5)) {
          console.log(chalk.gray(`    - ${pin.reference}.${pin.pin} at (${pin.position.x}, ${pin.position.y})`));
        }
        if (net.pins.length > 5) {
          console.log(chalk.gray(`    ... and ${net.pins.length - 5} more pins`));
        }
      }
    }
  });
