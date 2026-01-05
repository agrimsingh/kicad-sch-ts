// src/adapters/cli/commands/bom-manage.ts

import { Command } from "commander";
import { BOMPropertyAuditor } from "../../../bom/auditor";
import chalk from "chalk";

export const bomManageCommand = new Command("bom-manage")
  .description("Generate BOM report from schematic files")
  .argument("<path>", "Schematic file or directory")
  .option("-o, --output <path>", "Output CSV file path", "bom.csv")
  .option("-r, --recursive", "Recursively search directories", false)
  .option("--exclude-dnp", "Exclude DNP components", true)
  .action(async (path, options) => {
    console.log(chalk.blue(`Generating BOM from: ${path}`));

    const auditor = new BOMPropertyAuditor();
    
    // Generate BOM entries
    const bom = auditor.generateBOM(path, options.excludeDnp);

    // Export to CSV
    auditor.exportBOMToCsv(bom, options.output);
    
    console.log(chalk.green(`✓ BOM generated: ${options.output}`));
    console.log(chalk.gray(`  Unique entries: ${bom.length}`));
    console.log(chalk.gray(`  Total components: ${bom.reduce((sum, entry) => sum + entry.quantity, 0)}`));
  });
