// src/index.ts

// Main entry point - re-export public API

// Core modules
export { Schematic } from "./core/schematic";
export { SExpressionParser, Symbol, Float, type SExp } from "./core/parser";
export { ExactFormatter } from "./core/formatter";
export * from "./core/types";
export * from "./core/exceptions";
export * from "./core/logger";
export {
  KiCADConfig,
  GridSettings,
  PositioningSettings,
  ToleranceSettings,
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  resetConfig,
  GRID_SIZE,
  toSchematicPoint,
  fromSchematicPoint,
} from "./core/config";
export * from "./core/collections";

// Part 2: Library & Analysis modules
export * from "./library";
export * from "./geometry";
export * from "./connectivity";
export * from "./validation";
export * from "./bom";
export * from "./discovery";
export * from "./exporters";
export * from "./core/managers";

// Note: Adapters (CLI, MCP) are not exported from the main entry point.
// Import them directly from "kicad-sch-ts/dist/adapters" if needed.
