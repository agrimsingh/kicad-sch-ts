// src/adapters/mcp/tools/get-symbol-info.ts

import { getSymbolCache } from "../../../library/cache";

export const getSymbolInfoTool = {
  name: "get_symbol_info",
  description: "Get detailed information about a specific symbol",
  inputSchema: {
    type: "object",
    properties: {
      lib_id: {
        type: "string",
        description: "Library ID of the symbol (e.g., Device:R)",
      },
    },
    required: ["lib_id"],
  },
};

export async function handleGetSymbolInfo(args: any): Promise<any> {
  const { lib_id } = args;
  const cache = getSymbolCache();
  const symbol = cache.getSymbol(lib_id);

  if (!symbol) {
    throw new Error(`Symbol not found: ${lib_id}`);
  }

  // Collect pins from all units
  const pins: Array<{ number: string; name: string; type: string }> = [];
  for (const [, unit] of symbol.units) {
    for (const pin of unit.pins) {
      pins.push({
        number: pin.number,
        name: pin.name,
        type: pin.electricalType,
      });
    }
  }

  return {
    libId: symbol.libId,
    name: symbol.name,
    description: symbol.description,
    keywords: symbol.keywords,
    referencePrefix: symbol.referencePrefix,
    unitCount: symbol.units.size,
    pins,
  };
}
