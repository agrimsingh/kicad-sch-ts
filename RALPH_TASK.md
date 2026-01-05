---
task: "Port kicad-sch-api to TypeScript - Part 3: Adapters & Packaging"
test_command: "npm test"
completion_criteria:
  - CLI adapter is fully implemented with all 9+ commands
  - MCP server is fully implemented with all 15+ tools
  - All end-to-end integration tests pass
  - Library is documented, packaged, and ready for publishing to npm
max_iterations: 100
---

# Task: Port `kicad-sch-api` to TypeScript - Part 3: Adapters & Packaging

This is **Part 3 of 3**, the final part. This part exposes the Core Engine and Analysis modules through user-facing interfaces: a Command Line Interface (CLI) and a Model Context Protocol (MCP) server for AI assistants.

## Prerequisite

**Parts 1 and 2 must be complete.** The Core Engine and Analysis modules must be fully functional and tested. Verify by running `npm test` and ensuring all tests pass.

## The One-Line Success Criterion for Part 3

The library is published to npm and can be used by both human developers via a feature-rich CLI and AI agents via a compliant MCP server.

---

## Source Reference

Key Python files for Part 3:

- `kicad_sch_api/cli/` (~1500 lines total)
- `mcp_server/` (~2500 lines total)

---

## File Structure (Part 3 Additions)

```
kicad-sch-ts/
├── src/
│   └── adapters/
│       ├── cli/
│       │   ├── index.ts          # Main CLI entry point
│       │   ├── commands/
│       │   │   ├── demo.ts       # demo command
│       │   │   ├── bom.ts        # bom command
│       │   │   ├── bom-manage.ts # bom-manage command
│       │   │   ├── erc.ts        # erc command
│       │   │   ├── netlist.ts    # netlist command
│       │   │   ├── find-libraries.ts
│       │   │   ├── kicad-to-python.ts
│       │   │   ├── export-docs.ts
│       │   │   └── mcp.ts        # Start MCP server
│       │   └── utils.ts
│       └── mcp/
│           ├── server.ts         # MCP server implementation
│           ├── tools/
│           │   ├── manage-schematic.ts
│           │   ├── manage-component.ts
│           │   ├── manage-wire.ts
│           │   ├── manage-label.ts
│           │   ├── analyze-connectivity.ts
│           │   ├── analyze-hierarchy.ts
│           │   ├── run-erc.ts
│           │   ├── search-symbols.ts
│           │   ├── get-symbol-info.ts
│           │   ├── discover-pins.ts
│           │   └── index.ts
│           └── index.ts
├── bin/
│   └── kicad-sch.js              # CLI executable
├── README.md
├── CHANGELOG.md
└── package.json                  # Updated with bin entry
```

---

## Additional Dependencies (Part 3)

Add these to `package.json`:

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "chalk": "^5.3.0"
  },
  "bin": {
    "kicad-sch": "./bin/kicad-sch.js"
  }
}
```

---

## CLI Entry Point (`src/adapters/cli/index.ts`)

```typescript
#!/usr/bin/env node
// src/adapters/cli/index.ts

import { Command } from "commander";
import { demoCommand } from "./commands/demo";
import { bomCommand } from "./commands/bom";
import { bomManageCommand } from "./commands/bom-manage";
import { ercCommand } from "./commands/erc";
import { netlistCommand } from "./commands/netlist";
import { findLibrariesCommand } from "./commands/find-libraries";
import { kicadToPythonCommand } from "./commands/kicad-to-python";
import { exportDocsCommand } from "./commands/export-docs";
import { mcpCommand } from "./commands/mcp";

const program = new Command();

program
  .name("kicad-sch")
  .description("KiCAD Schematic API - TypeScript Edition")
  .version("1.0.0");

// Register all commands
program.addCommand(demoCommand);
program.addCommand(bomCommand);
program.addCommand(bomManageCommand);
program.addCommand(ercCommand);
program.addCommand(netlistCommand);
program.addCommand(findLibrariesCommand);
program.addCommand(kicadToPythonCommand);
program.addCommand(exportDocsCommand);
program.addCommand(mcpCommand);

program.parse();
```

---

## CLI Commands

### Demo Command (`src/adapters/cli/commands/demo.ts`)

```typescript
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
```

### BOM Command (`src/adapters/cli/commands/bom.ts`)

```typescript
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
```

### ERC Command (`src/adapters/cli/commands/erc.ts`)

```typescript
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
```

### Find Libraries Command (`src/adapters/cli/commands/find-libraries.ts`)

```typescript
// src/adapters/cli/commands/find-libraries.ts

import { Command } from "commander";
import { getSymbolCache } from "../../../library/cache";
import chalk from "chalk";

export const findLibrariesCommand = new Command("find-libraries")
  .description("Find and list available KiCAD symbol libraries")
  .option("-s, --search <query>", "Search for symbols")
  .option("-l, --library <name>", "List symbols in a specific library")
  .action(async (options) => {
    const cache = getSymbolCache();

    if (options.search) {
      console.log(chalk.blue(`Searching for: ${options.search}`));
      const results = cache.searchSymbols(options.search, 20);

      if (results.length === 0) {
        console.log(chalk.yellow("No symbols found"));
      } else {
        for (const symbol of results) {
          console.log(chalk.green(`  ${symbol.libId}`));
          if (symbol.description) {
            console.log(chalk.gray(`    ${symbol.description}`));
          }
        }
      }
    } else if (options.library) {
      const symbols = cache.getLibrarySymbols(options.library);
      console.log(
        chalk.blue(`Library: ${options.library} (${symbols.length} symbols)`)
      );

      for (const symbol of symbols.slice(0, 50)) {
        console.log(chalk.green(`  ${symbol.name}`));
      }

      if (symbols.length > 50) {
        console.log(chalk.gray(`  ... and ${symbols.length - 50} more`));
      }
    } else {
      const libraries = cache.getLibraryNames();
      console.log(chalk.blue(`Found ${libraries.length} libraries:`));

      for (const lib of libraries) {
        console.log(chalk.green(`  ${lib}`));
      }
    }
  });
```

### KiCAD to Python Command (`src/adapters/cli/commands/kicad-to-python.ts`)

```typescript
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
```

### MCP Command (`src/adapters/cli/commands/mcp.ts`)

```typescript
// src/adapters/cli/commands/mcp.ts

import { Command } from "commander";
import { startMcpServer } from "../../mcp/server";
import chalk from "chalk";

export const mcpCommand = new Command("mcp")
  .description("Start the MCP server for AI assistant integration")
  .option("-t, --transport <type>", "Transport type (stdio, http)", "stdio")
  .option("-p, --port <number>", "HTTP port (for http transport)", "3000")
  .action(async (options) => {
    console.error(chalk.blue("Starting MCP server..."));
    console.error(chalk.gray(`Transport: ${options.transport}`));

    await startMcpServer({
      transport: options.transport,
      port: parseInt(options.port, 10),
    });
  });
```

---

## MCP Server (`src/adapters/mcp/server.ts`)

```typescript
// src/adapters/mcp/server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  manageSchematicTool,
  handleManageSchematic,
} from "./tools/manage-schematic";
import {
  manageComponentTool,
  handleManageComponent,
} from "./tools/manage-component";
import { manageWireTool, handleManageWire } from "./tools/manage-wire";
import { manageLabelTool, handleManageLabel } from "./tools/manage-label";
import {
  analyzeConnectivityTool,
  handleAnalyzeConnectivity,
} from "./tools/analyze-connectivity";
import { runErcTool, handleRunErc } from "./tools/run-erc";
import { searchSymbolsTool, handleSearchSymbols } from "./tools/search-symbols";
import {
  getSymbolInfoTool,
  handleGetSymbolInfo,
} from "./tools/get-symbol-info";
import { discoverPinsTool, handleDiscoverPins } from "./tools/discover-pins";

const tools = [
  manageSchematicTool,
  manageComponentTool,
  manageWireTool,
  manageLabelTool,
  analyzeConnectivityTool,
  runErcTool,
  searchSymbolsTool,
  getSymbolInfoTool,
  discoverPinsTool,
];

const handlers: Record<string, (args: any) => Promise<any>> = {
  manage_schematic: handleManageSchematic,
  manage_component: handleManageComponent,
  manage_wire: handleManageWire,
  manage_label: handleManageLabel,
  analyze_connectivity: handleAnalyzeConnectivity,
  run_erc: handleRunErc,
  search_symbols: handleSearchSymbols,
  get_symbol_info: handleGetSymbolInfo,
  discover_pins: handleDiscoverPins,
};

export interface McpServerOptions {
  transport: "stdio" | "http";
  port?: number;
}

export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const server = new Server(
    {
      name: "kicad-sch-ts",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args);
      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  if (options.transport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP server running on stdio");
  } else {
    throw new Error("HTTP transport not yet implemented");
  }
}
```

---

## MCP Tools

### Manage Schematic Tool (`src/adapters/mcp/tools/manage-schematic.ts`)

```typescript
// src/adapters/mcp/tools/manage-schematic.ts

import { Schematic } from "../../../core/schematic";

export const manageSchematicTool = {
  name: "manage_schematic",
  description: "Create, load, or save KiCAD schematic files",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "load", "save", "info"],
        description: "Action to perform",
      },
      path: {
        type: "string",
        description: "File path for load/save operations",
      },
      title: {
        type: "string",
        description: "Title for new schematic (create action)",
      },
    },
    required: ["action"],
  },
};

// In-memory schematic storage for the session
let currentSchematic: Schematic | null = null;

export async function handleManageSchematic(args: any): Promise<any> {
  const { action, path, title } = args;

  switch (action) {
    case "create":
      currentSchematic = Schematic.create(title || "Untitled");
      return {
        success: true,
        message: `Created new schematic: ${title || "Untitled"}`,
        components: 0,
        wires: 0,
      };

    case "load":
      if (!path) throw new Error("Path required for load action");
      currentSchematic = Schematic.load(path);
      return {
        success: true,
        message: `Loaded schematic: ${path}`,
        title: currentSchematic.title,
        components: currentSchematic.components.length,
        wires: currentSchematic.wires.length,
        labels: currentSchematic.labels.length,
      };

    case "save":
      if (!currentSchematic) throw new Error("No schematic loaded");
      if (!path) throw new Error("Path required for save action");
      currentSchematic.save(path);
      return {
        success: true,
        message: `Saved schematic to: ${path}`,
      };

    case "info":
      if (!currentSchematic) throw new Error("No schematic loaded");
      return {
        title: currentSchematic.title,
        components: currentSchematic.components.length,
        wires: currentSchematic.wires.length,
        labels: currentSchematic.labels.length,
        junctions: currentSchematic.junctions.length,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export function getCurrentSchematic(): Schematic | null {
  return currentSchematic;
}

export function setCurrentSchematic(sch: Schematic): void {
  currentSchematic = sch;
}
```

### Manage Component Tool (`src/adapters/mcp/tools/manage-component.ts`)

```typescript
// src/adapters/mcp/tools/manage-component.ts

import { getCurrentSchematic } from "./manage-schematic";

export const manageComponentTool = {
  name: "manage_component",
  description: "Add, modify, or remove components in the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "modify", "remove", "list", "get"],
        description: "Action to perform",
      },
      reference: {
        type: "string",
        description: "Component reference (e.g., R1, C1)",
      },
      lib_id: {
        type: "string",
        description: "Library ID for new component (e.g., Device:R)",
      },
      value: {
        type: "string",
        description: "Component value",
      },
      position: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        description: "Position in schematic coordinates",
      },
      rotation: {
        type: "number",
        description: "Rotation in degrees (0, 90, 180, 270)",
      },
      footprint: {
        type: "string",
        description: "Footprint reference",
      },
      properties: {
        type: "object",
        description: "Additional properties to set",
      },
    },
    required: ["action"],
  },
};

export async function handleManageComponent(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const {
    action,
    reference,
    lib_id,
    value,
    position,
    rotation,
    footprint,
    properties,
  } = args;

  switch (action) {
    case "add":
      if (!lib_id || !reference || !value || !position) {
        throw new Error(
          "lib_id, reference, value, and position are required for add"
        );
      }
      const newComp = sch.components.add({
        libId: lib_id,
        reference,
        value,
        position,
        rotation,
        footprint,
        properties,
      });
      return {
        success: true,
        message: `Added component ${reference}`,
        uuid: newComp.uuid,
      };

    case "modify":
      if (!reference) throw new Error("reference required for modify");
      const comp = sch.components.get(reference);
      if (!comp) throw new Error(`Component not found: ${reference}`);

      if (value !== undefined) comp.value = value;
      if (footprint !== undefined) comp.footprint = footprint;
      if (properties) {
        for (const [key, val] of Object.entries(properties)) {
          comp.setProperty(key, val as string);
        }
      }
      return {
        success: true,
        message: `Modified component ${reference}`,
      };

    case "remove":
      if (!reference) throw new Error("reference required for remove");
      const removed = sch.components.remove(reference);
      return {
        success: removed,
        message: removed
          ? `Removed component ${reference}`
          : `Component not found: ${reference}`,
      };

    case "list":
      return {
        components: sch.components.map((c) => ({
          reference: c.reference,
          libId: c.libId,
          value: c.value,
          position: c.position,
        })),
      };

    case "get":
      if (!reference) throw new Error("reference required for get");
      const getComp = sch.components.get(reference);
      if (!getComp) throw new Error(`Component not found: ${reference}`);
      return {
        reference: getComp.reference,
        libId: getComp.libId,
        value: getComp.value,
        position: getComp.position,
        rotation: getComp.rotation,
        footprint: getComp.footprint,
        properties: getComp.properties,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
```

### Search Symbols Tool (`src/adapters/mcp/tools/search-symbols.ts`)

```typescript
// src/adapters/mcp/tools/search-symbols.ts

import { getSymbolCache } from "../../../library/cache";

export const searchSymbolsTool = {
  name: "search_symbols",
  description: "Search for KiCAD symbols by name or keywords",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      limit: {
        type: "number",
        description: "Maximum number of results",
        default: 20,
      },
    },
    required: ["query"],
  },
};

export async function handleSearchSymbols(args: any): Promise<any> {
  const { query, limit = 20 } = args;
  const cache = getSymbolCache();
  const results = cache.searchSymbols(query, limit);

  return {
    count: results.length,
    symbols: results.map((s) => ({
      libId: s.libId,
      name: s.name,
      description: s.description,
      keywords: s.keywords,
      referencePrefix: s.referencePrefix,
    })),
  };
}
```

### Run ERC Tool (`src/adapters/mcp/tools/run-erc.ts`)

```typescript
// src/adapters/mcp/tools/run-erc.ts

import { getCurrentSchematic } from "./manage-schematic";
import { ElectricalRulesChecker } from "../../../validation/erc";

export const runErcTool = {
  name: "run_erc",
  description: "Run Electrical Rules Check on the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      strict: {
        type: "boolean",
        description: "Treat warnings as errors",
        default: false,
      },
    },
  },
};

export async function handleRunErc(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded");

  const checker = new ElectricalRulesChecker(sch, {
    treatWarningsAsErrors: args.strict || false,
  });

  const result = checker.check();

  return {
    passed: result.passed,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    violations: result.violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
    })),
  };
}
```

---

## CLI Executable (`bin/kicad-sch.js`)

```javascript
#!/usr/bin/env node
require("../dist/adapters/cli/index.js");
```

---

## Updated `package.json`

```json
{
  "name": "kicad-sch-ts",
  "version": "1.0.0",
  "description": "TypeScript library for KiCAD schematic files",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "kicad-sch": "./bin/kicad-sch.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "prepublishOnly": "npm run build && npm test"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "commander": "^11.0.0",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.5",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": ["dist", "bin"],
  "keywords": ["kicad", "schematic", "eda", "electronics", "pcb"],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourorg/kicad-sch-ts.git"
  },
  "license": "MIT"
}
```

---

## README.md

````markdown
# kicad-sch-ts

A TypeScript library for programmatically reading, writing, and manipulating KiCAD 7/8 schematic files.

## Installation

\`\`\`bash
npm install kicad-sch-ts
\`\`\`

## Quick Start

\`\`\`typescript
import { Schematic } from 'kicad-sch-ts';

// Load an existing schematic
const sch = Schematic.load('my_project.kicad_sch');

// Add a component
sch.components.add({
libId: 'Device:R',
reference: 'R1',
value: '10k',
position: { x: 100.33, y: 101.6 },
});

// Add a wire
sch.wires.add({
start: { x: 100.33, y: 101.6 },
end: { x: 106.68, y: 101.6 },
});

// Save
sch.save('my_project.kicad_sch');
\`\`\`

## CLI Usage

\`\`\`bash

# Create a demo schematic

kicad-sch demo -o demo.kicad_sch

# Run ERC

kicad-sch erc my_project.kicad_sch

# Audit BOM properties

kicad-sch bom my_project.kicad_sch -p PartNumber,Manufacturer

# Search for symbols

kicad-sch find-libraries -s resistor

# Start MCP server

kicad-sch mcp
\`\`\`

## MCP Server

For AI assistant integration, start the MCP server:

\`\`\`bash
kicad-sch mcp
\`\`\`

Configure your AI assistant to connect to the server.

## API Reference

See the [API documentation](./docs/api.md) for full details.

## License

MIT
\`\`\`

---

## Phased Success Criteria (Part 3)

### Phase 1: CLI Adapter

- [x] Add `commander` and `chalk` dependencies
- [x] Implement main CLI entry point
- [x] Implement `demo` command
- [x] Implement `bom` command
- [x] Implement `bom-manage` command
- [x] Implement `erc` command
- [x] Implement `netlist` command
- [x] Implement `find-libraries` command
- [x] Implement `kicad-to-python` command
- [x] Implement `export-docs` command
- [x] Implement `mcp` command
- [x] Add `bin` entry to `package.json`
- [x] Pass CLI end-to-end tests

### Phase 2: MCP Server Adapter

- [x] Add `@modelcontextprotocol/sdk` dependency
- [x] Implement MCP server with stdio transport
- [x] Implement `manage_schematic` tool
- [x] Implement `manage_component` tool
- [x] Implement `manage_wire` tool
- [x] Implement `manage_label` tool
- [x] Implement `analyze_connectivity` tool
- [x] Implement `run_erc` tool
- [x] Implement `search_symbols` tool
- [x] Implement `get_symbol_info` tool
- [x] Implement `discover_pins` tool
- [x] Pass MCP server tests

### Phase 3: Documentation & Packaging

- [x] Write comprehensive `README.md`
- [x] Add JSDoc comments to public API
- [x] Create `CHANGELOG.md`
- [x] Verify `package.json` is correct
- [x] Run `npm publish --dry-run` successfully

---

## Mandatory Test Cases (Part 3)

### Test 1: CLI Demo Command

```typescript
// test/integration/cli.test.ts
import { execSync } from "child_process";
import { existsSync, rmSync, readFileSync } from "fs";

describe("CLI End-to-End Tests", () => {
  const testOutput = "/tmp/cli_test_demo.kicad_sch";

  beforeEach(() => {
    if (existsSync(testOutput)) rmSync(testOutput);
  });

  afterEach(() => {
    if (existsSync(testOutput)) rmSync(testOutput);
  });

  it("should create a demo schematic", () => {
    const output = execSync(
      `npx ts-node src/adapters/cli/index.ts demo -o ${testOutput}`,
      {
        encoding: "utf-8",
      }
    );

    expect(output).toContain("Demo schematic created");
    expect(existsSync(testOutput)).toBe(true);

    const content = readFileSync(testOutput, "utf-8");
    expect(content).toContain("kicad_sch");
    expect(content).toContain("Device:R");
  });
});
```
````

### Test 2: CLI ERC Command

```typescript
it("should run ERC and report results", () => {
  const output = execSync(
    `npx ts-node src/adapters/cli/index.ts erc test/fixtures/single_resistor/single_resistor.kicad_sch`,
    { encoding: "utf-8" }
  );

  expect(output).toContain("ERC");
});
```

### Test 3: CLI Find Libraries Command

```typescript
it("should list available libraries", () => {
  const output = execSync(
    `npx ts-node src/adapters/cli/index.ts find-libraries`,
    { encoding: "utf-8" }
  );

  expect(output).toContain("libraries");
});
```

### Test 4: MCP Server Tools List

```typescript
// test/integration/mcp.test.ts
import {
  manageSchematicTool,
  manageComponentTool,
  searchSymbolsTool,
} from "../../src/adapters/mcp/tools";

describe("MCP Tools", () => {
  it("should have correct tool definitions", () => {
    expect(manageSchematicTool.name).toBe("manage_schematic");
    expect(manageSchematicTool.inputSchema).toBeDefined();

    expect(manageComponentTool.name).toBe("manage_component");
    expect(searchSymbolsTool.name).toBe("search_symbols");
  });
});
```

### Test 5: MCP Schematic Management

```typescript
import {
  handleManageSchematic,
  getCurrentSchematic,
} from "../../src/adapters/mcp/tools/manage-schematic";

describe("MCP Schematic Management", () => {
  it("should create a new schematic", async () => {
    const result = await handleManageSchematic({
      action: "create",
      title: "Test Schematic",
    });

    expect(result.success).toBe(true);
    expect(getCurrentSchematic()).not.toBeNull();
  });
});
```

### Test 6: MCP Component Management

```typescript
import { handleManageSchematic } from "../../src/adapters/mcp/tools/manage-schematic";
import { handleManageComponent } from "../../src/adapters/mcp/tools/manage-component";

describe("MCP Component Management", () => {
  beforeEach(async () => {
    await handleManageSchematic({ action: "create", title: "Test" });
  });

  it("should add a component", async () => {
    const result = await handleManageComponent({
      action: "add",
      lib_id: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });

    expect(result.success).toBe(true);
    expect(result.uuid).toBeDefined();
  });

  it("should list components", async () => {
    await handleManageComponent({
      action: "add",
      lib_id: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });

    const result = await handleManageComponent({ action: "list" });
    expect(result.components).toHaveLength(1);
    expect(result.components[0].reference).toBe("R1");
  });
});
```

---

## Agent Instructions

1. **Focus on Interfaces:** The goal is to expose existing functionality. Avoid adding new core logic.
2. **End-to-End Testing:** The most important tests are integration tests that run actual CLI commands.
3. **Prepare for Release:** The final output should be a library ready to publish.
4. **Signal Final Completion:** When all tests pass and the package is ready:
   ```
   ✅ PORT COMPLETE: kicad-sch-ts v1.0.0 ready for release.
      - 3/3 parts complete
      - All tests passing
      - Round-trip verification: PASSED
      - KiCAD 8 compatibility: VERIFIED
   ```
