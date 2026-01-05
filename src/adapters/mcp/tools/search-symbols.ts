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
