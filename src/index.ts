// src/index.ts

// Main entry point - re-export public API

export { Schematic } from "./core/schematic";
export { SExpressionParser, Symbol, type SExp } from "./core/parser";
export { ExactFormatter } from "./core/formatter";
export * from "./core/types";
export * from "./core/exceptions";
export * from "./core/config";
export * from "./core/collections";
