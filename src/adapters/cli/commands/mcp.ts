// src/adapters/cli/commands/mcp.ts

import { Command } from "commander";
import chalk from "chalk";

export const mcpCommand = new Command("mcp")
  .description("Start the MCP server for AI assistant integration")
  .option("-t, --transport <type>", "Transport type (stdio, http)", "stdio")
  .option("-p, --port <number>", "HTTP port (for http transport)", "3000")
  .action(async (options) => {
    console.error(chalk.blue("Starting MCP server..."));
    console.error(chalk.gray(`Transport: ${options.transport}`));

    // Dynamic import to avoid ESM issues in CommonJS context
    const { startMcpServer } = await import("../../mcp/server.js");
    
    await startMcpServer({
      transport: options.transport,
      port: parseInt(options.port, 10),
    });
  });
