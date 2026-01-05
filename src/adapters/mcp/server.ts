// src/adapters/mcp/server.ts

type McpServerModule = typeof import("@modelcontextprotocol/sdk/server/index.js");
type McpStdioModule = typeof import("@modelcontextprotocol/sdk/server/stdio.js");
type McpTypesModule = typeof import("@modelcontextprotocol/sdk/types.js");

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
import {
  analyzeHierarchyTool,
  handleAnalyzeHierarchy,
} from "./tools/analyze-hierarchy";
import { runErcTool, handleRunErc } from "./tools/run-erc";
import { searchSymbolsTool, handleSearchSymbols } from "./tools/search-symbols";
import {
  getSymbolInfoTool,
  handleGetSymbolInfo,
} from "./tools/get-symbol-info";
import { discoverPinsTool, handleDiscoverPins } from "./tools/discover-pins";
import {
  manageSymbolLibraryTool,
  handleManageSymbolLibrary,
} from "./tools/manage-symbol-library";
import { createLogger } from "../../core/logger";

const tools = [
  manageSchematicTool,
  manageComponentTool,
  manageWireTool,
  manageLabelTool,
  analyzeConnectivityTool,
  analyzeHierarchyTool,
  runErcTool,
  searchSymbolsTool,
  getSymbolInfoTool,
  discoverPinsTool,
  manageSymbolLibraryTool,
];

const handlers: Record<string, (args: any) => Promise<any>> = {
  manage_schematic: handleManageSchematic,
  manage_component: handleManageComponent,
  manage_wire: handleManageWire,
  manage_label: handleManageLabel,
  analyze_connectivity: handleAnalyzeConnectivity,
  analyze_hierarchy: handleAnalyzeHierarchy,
  run_erc: handleRunErc,
  search_symbols: handleSearchSymbols,
  get_symbol_info: handleGetSymbolInfo,
  discover_pins: handleDiscoverPins,
  manage_symbol_library: handleManageSymbolLibrary,
};

// Preserve native import() in CommonJS output for ESM-only deps.
const dynamicImport = async <T>(specifier: string): Promise<T> => {
  const loader = new Function("specifier", "return import(specifier)");
  return loader(specifier) as Promise<T>;
};

export interface McpServerOptions {
  transport: "stdio" | "http";
  port?: number;
}

export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const [{ Server }, { StdioServerTransport }, sdkTypes] = await Promise.all([
    dynamicImport<McpServerModule>("@modelcontextprotocol/sdk/server/index.js"),
    dynamicImport<McpStdioModule>("@modelcontextprotocol/sdk/server/stdio.js"),
    dynamicImport<McpTypesModule>("@modelcontextprotocol/sdk/types.js"),
  ]);
  const { CallToolRequestSchema, ListToolsRequestSchema } = sdkTypes;
  const logger = createLogger({ name: "mcp-server", level: "info" });
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
      const payload = {
        success: false,
        error: {
          message: error?.message || "Unknown error",
        },
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  if (options.transport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("MCP server running on stdio");
  } else {
    throw new Error("HTTP transport not yet implemented");
  }
}
