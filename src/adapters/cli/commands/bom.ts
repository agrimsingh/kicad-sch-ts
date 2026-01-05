// src/adapters/cli/commands/bom.ts

import { Command } from "commander";
import { BOMPropertyAuditor } from "../../../bom/auditor";
import chalk from "chalk";

export const bomCommand = new Command("bom")
  .description("Audit BOM properties in schematic files")
  .argument("<path>", "Schematic file or directory to audit")
  .option(
    "-p, --properties <props>",
    "Required properties (comma-separated)",
    "PartNumber,Manufacturer"
  )
  .option("-r, --recursive", "Recursively search directories", false)
  .option("--exclude-dnp", "Exclude DNP components", false)
  .option("-o, --output <path>", "Output CSV report path")
  .action(async (path, options) => {
    const auditor = new BOMPropertyAuditor();
    const requiredProps = options.properties
      .split(",")
      .map((p: string) => p.trim());

    console.log(
      chalk.blue(`Auditing BOM properties: ${requiredProps.join(", ")}`)
    );

    let issues;
    if (path.endsWith(".kicad_sch")) {
      issues = auditor.auditSchematic(path, requiredProps, options.excludeDnp);
    } else {
      issues = auditor.auditDirectory(
        path,
        requiredProps,
        options.recursive,
        options.excludeDnp
      );
    }

    if (issues.length === 0) {
      console.log(chalk.green("✓ All components have required properties"));
    } else {
      console.log(
        chalk.yellow(
          `⚠ Found ${issues.length} components with missing properties:`
        )
      );

      for (const issue of issues.slice(0, 10)) {
        console.log(
          chalk.red(
            `  ${issue.reference}: missing ${issue.missingProperties.join(
              ", "
            )}`
          )
        );
      }

      if (issues.length > 10) {
        console.log(chalk.gray(`  ... and ${issues.length - 10} more`));
      }

      if (options.output) {
        auditor.generateCsvReport(issues, options.output);
        console.log(chalk.blue(`Report saved to: ${options.output}`));
      }
    }
  });
