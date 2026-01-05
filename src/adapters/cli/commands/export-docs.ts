// src/adapters/cli/commands/export-docs.ts

import { Command } from "commander";
import { writeFileSync } from "fs";
import { Schematic } from "../../../core/schematic";
import chalk from "chalk";

export const exportDocsCommand = new Command("export-docs")
  .description("Export schematic documentation")
  .argument("<input>", "Input schematic file")
  .option("-o, --output <path>", "Output file path")
  .option("-f, --format <type>", "Output format (markdown, json, html)", "markdown")
  .action(async (input, options) => {
    console.log(chalk.blue(`Exporting documentation for: ${input}`));

    const sch = Schematic.load(input);
    
    let output: string;
    
    switch (options.format) {
      case "json":
        output = JSON.stringify({
          title: sch.title,
          components: sch.components.map(c => ({
            reference: c.reference,
            libId: c.libId,
            value: c.value,
            footprint: c.footprint,
          })),
          wires: sch.wires.length,
          labels: sch.labels.length,
          junctions: sch.junctions.length,
        }, null, 2);
        break;
        
      case "html":
        output = `<!DOCTYPE html>
<html>
<head>
  <title>${sch.title || 'Schematic Documentation'}</title>
  <style>
    body { font-family: sans-serif; margin: 2em; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; }
  </style>
</head>
<body>
  <h1>${sch.title || 'Schematic Documentation'}</h1>
  <h2>Components (${sch.components.length})</h2>
  <table>
    <tr><th>Reference</th><th>Value</th><th>Library ID</th><th>Footprint</th></tr>
    ${sch.components.map(c => 
      `<tr><td>${c.reference}</td><td>${c.value}</td><td>${c.libId}</td><td>${c.footprint || ''}</td></tr>`
    ).join('\n    ')}
  </table>
  <h2>Statistics</h2>
  <ul>
    <li>Wires: ${sch.wires.length}</li>
    <li>Labels: ${sch.labels.length}</li>
    <li>Junctions: ${sch.junctions.length}</li>
  </ul>
</body>
</html>`;
        break;
        
      case "markdown":
      default:
        output = `# ${sch.title || 'Schematic Documentation'}

## Components (${sch.components.length})

| Reference | Value | Library ID | Footprint |
|-----------|-------|------------|-----------|
${sch.components.map(c => 
  `| ${c.reference} | ${c.value} | ${c.libId} | ${c.footprint || ''} |`
).join('\n')}

## Statistics

- Wires: ${sch.wires.length}
- Labels: ${sch.labels.length}
- Junctions: ${sch.junctions.length}
`;
        break;
    }

    if (options.output) {
      writeFileSync(options.output, output);
      console.log(chalk.green(`✓ Documentation saved to: ${options.output}`));
    } else {
      console.log(output);
    }
  });
