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
