// src/adapters/mcp/tools/index.ts

export {
  manageSchematicTool,
  handleManageSchematic,
  getCurrentSchematic,
  setCurrentSchematic,
} from "./manage-schematic";

export {
  manageComponentTool,
  handleManageComponent,
} from "./manage-component";

export { manageWireTool, handleManageWire } from "./manage-wire";

export { manageLabelTool, handleManageLabel } from "./manage-label";

export {
  analyzeConnectivityTool,
  handleAnalyzeConnectivity,
} from "./analyze-connectivity";

export {
  analyzeHierarchyTool,
  handleAnalyzeHierarchy,
} from "./analyze-hierarchy";

export { runErcTool, handleRunErc } from "./run-erc";

export { searchSymbolsTool, handleSearchSymbols } from "./search-symbols";

export { getSymbolInfoTool, handleGetSymbolInfo } from "./get-symbol-info";

export { discoverPinsTool, handleDiscoverPins } from "./discover-pins";
