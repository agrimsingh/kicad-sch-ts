// src/adapters/cli/commands/erc.ts

import { Command } from "commander";
import { Schematic } from "../../../core/schematic";
import { ElectricalRulesChecker, ERCSeverity } from "../../../validation/erc";
import chalk from "chalk";

export const ercCommand = new Command("erc")
  .description("Run Electrical Rules Check on a schematic")
  .argument("<path>", "Schematic file to check")
  .option("--strict", "Treat warnings as errors", false)
  .action(async (path, options) => {
    console.log(chalk.blue(`Running ERC on: ${path}`));

    const sch = Schematic.load(path);
    const checker = new ElectricalRulesChecker(sch, {
      treatWarningsAsErrors: options.strict,
    });

    const result = checker.check();

    if (result.passed) {
      console.log(chalk.green("✓ ERC passed"));
    } else {
      console.log(chalk.red("✗ ERC failed"));
    }

    console.log(chalk.gray(`  Errors: ${result.errorCount}`));
    console.log(chalk.gray(`  Warnings: ${result.warningCount}`));

    for (const violation of result.violations) {
      const color =
        violation.severity === ERCSeverity.ERROR ? chalk.red : chalk.yellow;
      console.log(
        color(
          `  [${violation.severity.toUpperCase()}] ${violation.code}: ${
            violation.message
          }`
        )
      );
    }

    process.exit(result.passed ? 0 : 1);
  });
