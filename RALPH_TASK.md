---
task: "Port kicad-sch-api to TypeScript - Part 1: Core Engine"
test_command: "npm test"
completion_criteria:
  - Core S-expression parser and formatter working with exact format preservation
  - All data models (types, exceptions, config) ported from Python to TypeScript
  - All collection classes (components, wires, labels, etc.) implemented
  - Basic Schematic class can load, parse, format, and save any .kicad_sch file
  - All round-trip tests for reference files pass with byte-for-byte identity
max_iterations: 150
---

# Task: Port `kicad-sch-api` to TypeScript - Part 1: Core Engine

This is **Part 1 of 3** of a project to faithfully port the Python library `kicad-sch-api` to TypeScript. This part focuses on building the **Core Engine**: a robust foundation that can parse, represent, and format KiCAD schematic files with perfect fidelity.

## The One-Line Success Criterion for Part 1

For any KiCAD schematic, the library must be able to read it into a set of TypeScript objects and write it back to a `.kicad_sch` file that is **byte-for-byte identical** to the original.

---

## Source Reference

The Python source code is located at: `https://github.com/circuit-synth/kicad-sch-api`

Clone it locally and use it as the authoritative reference:

```bash
git clone https://github.com/circuit-synth/kicad-sch-api.git
```

Key Python files for Part 1:

- `kicad_sch_api/core/types.py` (~1215 lines)
- `kicad_sch_api/core/parser.py` (~1033 lines)
- `kicad_sch_api/core/formatter.py` (~1105 lines)
- `kicad_sch_api/core/exceptions.py` (~145 lines)
- `kicad_sch_api/core/config.py` (~314 lines)
- `kicad_sch_api/core/schematic.py` (~2107 lines)
- `kicad_sch_api/core/collections/` (~2000 lines total)

---

## ⚠️ CRITICAL: KiCAD Coordinate System

KiCAD uses TWO different coordinate systems. Understanding this is essential for correct implementation.

| System              | Y-Axis Direction      | Where Used                                       |
| ------------------- | --------------------- | ------------------------------------------------ |
| **Symbol Space**    | +Y is UP (normal)     | Library symbol definitions (`.kicad_sym` files)  |
| **Schematic Space** | +Y is DOWN (inverted) | Placed components, wires, labels in `.kicad_sch` |

**The Y-Negation Rule:** When transforming from symbol space to schematic space, Y coordinates MUST be negated:

```typescript
// CORRECT transformation
function transformPinToSchematic(
  pinPos: Point,
  componentPos: Point,
  rotation: number = 0,
  mirror?: "x" | "y"
): Point {
  // Step 1: Negate Y (symbol space -> schematic space)
  let x = pinPos.x;
  let y = -pinPos.y; // CRITICAL: Y-negation

  // Step 2: Apply mirror if present
  if (mirror === "x") x = -x;
  if (mirror === "y") y = -y;

  // Step 3: Apply rotation
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotX = x * cos - y * sin;
  const rotY = x * sin + y * cos;

  // Step 4: Translate to component position
  return {
    x: componentPos.x + rotX,
    y: componentPos.y + rotY,
  };
}
```

**Grid Alignment:** ALL positions MUST be on a 1.27mm (50 mil) grid:

```typescript
const GRID_SIZE = 1.27;

function snapToGrid(point: Point): Point {
  return {
    x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
  };
}

function isOnGrid(point: Point): boolean {
  const snapped = snapToGrid(point);
  return (
    Math.abs(point.x - snapped.x) < 0.001 &&
    Math.abs(point.y - snapped.y) < 0.001
  );
}
```

---

## Understanding the KiCAD Schematic Format

KiCAD schematic files (`.kicad_sch`) use an **S-expression** format—nested lists enclosed in parentheses:

```lisp
(kicad_sch
  (version 20231120)
  (generator "eeschema")
  (generator_version "8.0")
  (uuid "a5ebdc97-f1ba-4650-8f00-5e19694cb317")
  (paper "A4")

  (lib_symbols
    (symbol "Device:R"
      (property "Reference" "R" (at 2.032 0 90) ...)
      (symbol "Device:R_0_1"
        (rectangle (start -1.016 -2.54) (end 1.016 2.54) ...)
      )
      (symbol "Device:R_1_1"
        (pin passive line (at 0 3.81 270) (length 1.27) ...)
      )
    )
  )

  (symbol
    (lib_id "Device:R")
    (at 93.98 81.28 0)
    (unit 1)
    (uuid "a9fd95f7-...")
    (property "Reference" "R1" (at 95.25 80.01 0) ...)
    (property "Value" "10k" (at 95.25 82.55 0) ...)
  )

  (wire (pts (xy 100 80) (xy 100 90)) (stroke ...) (uuid "..."))
  (label "VCC" (at 100 75 0) (effects ...) (uuid "..."))
  (junction (at 100 80) (diameter 0) (color 0 0 0 0) (uuid "..."))
)
```

---

## File Structure (Part 1)

```
kicad-sch-ts/
├── package.json
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── index.ts                    # Main entry point, re-exports public API
│   └── core/
│       ├── types.ts                # All interfaces and enums
│       ├── exceptions.ts           # Error classes
│       ├── config.ts               # Configuration
│       ├── parser.ts               # S-expression parser
│       ├── formatter.ts            # S-expression formatter
│       ├── schematic.ts            # Main Schematic class
│       ├── collections/
│       │   ├── base.ts             # BaseCollection, IndexRegistry
│       │   ├── component.ts        # ComponentCollection
│       │   ├── wire.ts             # WireCollection
│       │   ├── label.ts            # LabelCollection
│       │   ├── junction.ts         # JunctionCollection
│       │   ├── no-connect.ts       # NoConnectCollection
│       │   ├── bus.ts              # BusCollection, BusEntryCollection
│       │   ├── sheet.ts            # SheetCollection
│       │   ├── text.ts             # TextCollection, TextBoxCollection
│       │   ├── graphics.ts         # RectangleCollection, ImageCollection
│       │   └── index.ts            # Re-exports
│       └── parsers/
│           ├── symbol-parser.ts    # Component/symbol parsing
│           ├── wire-parser.ts      # Wire parsing
│           ├── label-parser.ts     # Label parsing
│           └── index.ts            # Re-exports
├── test/
│   ├── unit/
│   │   ├── parser.test.ts
│   │   ├── formatter.test.ts
│   │   └── types.test.ts
│   ├── integration/
│   │   └── round-trip.test.ts
│   └── fixtures/                   # Copy from Python project
│       ├── blank/
│       ├── single_resistor/
│       ├── rotated_resistor_0deg/
│       ├── rotated_resistor_90deg/
│       ├── rotated_resistor_180deg/
│       └── rotated_resistor_270deg/
└── bin/
    └── kicad-sch.js
```

---

## Dependencies (Part 1)

```json
{
  "name": "kicad-sch-ts",
  "version": "1.0.0",
  "description": "TypeScript library for KiCAD schematic files",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## Core Types (`src/core/types.ts`)

Port from `kicad_sch_api/core/types.py`. This file defines ALL data structures.

```typescript
// src/core/types.ts

// ============================================================
// Basic Geometric Types
// ============================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rectangle {
  start: Point;
  end: Point;
}

// ============================================================
// Enums
// ============================================================

export enum PinType {
  INPUT = "input",
  OUTPUT = "output",
  BIDIRECTIONAL = "bidirectional",
  TRI_STATE = "tri_state",
  PASSIVE = "passive",
  FREE = "free",
  UNSPECIFIED = "unspecified",
  POWER_IN = "power_in",
  POWER_OUT = "power_out",
  OPEN_COLLECTOR = "open_collector",
  OPEN_EMITTER = "open_emitter",
  NO_CONNECT = "no_connect",
}

export enum PinShape {
  LINE = "line",
  INVERTED = "inverted",
  CLOCK = "clock",
  INVERTED_CLOCK = "inverted_clock",
  INPUT_LOW = "input_low",
  CLOCK_LOW = "clock_low",
  OUTPUT_LOW = "output_low",
  EDGE_CLOCK_HIGH = "edge_clock_high",
  NON_LOGIC = "non_logic",
}

export enum WireType {
  WIRE = "wire",
  BUS = "bus",
  BUS_ENTRY = "bus_entry",
}

export enum LabelType {
  LOCAL = "label",
  GLOBAL = "global_label",
  HIERARCHICAL = "hierarchical_label",
}

export enum HierarchicalLabelShape {
  INPUT = "input",
  OUTPUT = "output",
  BIDIRECTIONAL = "bidirectional",
  TRI_STATE = "tri_state",
  PASSIVE = "passive",
}

export enum TextJustify {
  LEFT = "left",
  CENTER = "center",
  RIGHT = "right",
}

export enum TextVerticalJustify {
  TOP = "top",
  CENTER = "center",
  BOTTOM = "bottom",
}

export enum StrokeType {
  DEFAULT = "default",
  SOLID = "solid",
  DASH = "dash",
  DOT = "dot",
  DASH_DOT = "dash_dot",
  DASH_DOT_DOT = "dash_dot_dot",
}

export enum FillType {
  NONE = "none",
  OUTLINE = "outline",
  BACKGROUND = "background",
}

// ============================================================
// Text Effects
// ============================================================

export interface TextEffects {
  font?: {
    face?: string;
    size: [number, number]; // [width, height]
    thickness?: number;
    bold?: boolean;
    italic?: boolean;
    color?: [number, number, number, number]; // RGBA
  };
  justify?: {
    horizontal?: TextJustify;
    vertical?: TextVerticalJustify;
    mirror?: boolean;
  };
  hide?: boolean;
}

// ============================================================
// Property Value (for component properties)
// ============================================================

export interface PropertyValue {
  value: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
  showName?: boolean;
}

// ============================================================
// Stroke
// ============================================================

export interface Stroke {
  width: number;
  type: StrokeType;
  color?: [number, number, number, number];
}

// ============================================================
// Title Block
// ============================================================

export interface TitleBlock {
  title?: string;
  date?: string;
  rev?: string;
  company?: string;
  comment: Map<number, string>;
}

// ============================================================
// Schematic Symbol (placed component)
// ============================================================

export interface SchematicSymbol {
  uuid: string;
  libId: string;
  position: Point;
  rotation: number;
  mirror?: "x" | "y";
  unit: number;
  inBom: boolean;
  onBoard: boolean;
  excludeFromSim: boolean;
  dnp: boolean;
  fieldsAutoplaced?: boolean;
  properties: Map<string, PropertyValue>;
  pins: Map<string, string>; // pin number -> pin uuid
  instances?: SymbolInstance[];
}

export interface SymbolInstance {
  project: string;
  path: string;
  reference: string;
  unit: number;
}

// ============================================================
// Wire
// ============================================================

export interface Wire {
  uuid: string;
  points: Point[];
  stroke?: Stroke;
}

// ============================================================
// Bus
// ============================================================

export interface Bus {
  uuid: string;
  points: Point[];
  stroke?: Stroke;
}

export interface BusEntry {
  uuid: string;
  position: Point;
  size: Size;
  stroke?: Stroke;
}

// ============================================================
// Labels
// ============================================================

export interface Label {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
  fieldsAutoplaced?: boolean;
}

export interface GlobalLabel extends Label {
  shape: HierarchicalLabelShape;
  properties: Map<string, PropertyValue>;
}

export interface HierarchicalLabel extends Label {
  shape: HierarchicalLabelShape;
}

// ============================================================
// Junction & No Connect
// ============================================================

export interface Junction {
  uuid: string;
  position: Point;
  diameter: number;
  color: [number, number, number, number];
}

export interface NoConnect {
  uuid: string;
  position: Point;
}

// ============================================================
// Sheet (Hierarchical)
// ============================================================

export interface Sheet {
  uuid: string;
  position: Point;
  size: Size;
  fieldsAutoplaced?: boolean;
  stroke?: Stroke;
  fill?: { color: [number, number, number, number] };
  name: PropertyValue;
  filename: PropertyValue;
  pins: SheetPin[];
  instances?: SheetInstance[];
}

export interface SheetPin {
  uuid: string;
  name: string;
  shape: HierarchicalLabelShape;
  position: Point;
  rotation: number;
  effects?: TextEffects;
}

export interface SheetInstance {
  project: string;
  path: string;
  page: string;
}

// ============================================================
// Text Elements
// ============================================================

export interface Text {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
}

export interface TextBox {
  uuid: string;
  text: string;
  position: Point;
  size: Size;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
  effects?: TextEffects;
}

// ============================================================
// Graphics
// ============================================================

export interface SchematicRectangle {
  uuid: string;
  start: Point;
  end: Point;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export interface SchematicImage {
  uuid: string;
  position: Point;
  scale: number;
  data: string; // Base64 encoded
}

// ============================================================
// Symbol Definition (from lib_symbols or .kicad_sym)
// ============================================================

export interface SymbolDefinition {
  libId: string;
  name: string;
  library: string;
  referencePrefix: string;
  description: string;
  keywords: string;
  datasheet: string;
  unitCount: number;
  unitsLocked: boolean;
  isPower: boolean;
  pinNames: { offset: number; hide: boolean };
  pinNumbers: { hide: boolean };
  inBom: boolean;
  onBoard: boolean;
  properties: Map<string, PropertyValue>;
  units: Map<number, SymbolUnit>;
}

export interface SymbolUnit {
  unitNumber: number;
  style: number;
  graphics: SymbolGraphics[];
  pins: SymbolPin[];
}

export interface SymbolPin {
  number: string;
  name: string;
  position: Point;
  length: number;
  rotation: number;
  electricalType: PinType;
  graphicStyle: PinShape;
  nameEffects?: TextEffects;
  numberEffects?: TextEffects;
  hide: boolean;
  alternate: Array<{ name: string; type: PinType; shape: PinShape }>;
}

export interface SymbolGraphics {
  type: "rectangle" | "circle" | "arc" | "polyline" | "text";
  // Additional properties depend on type
  [key: string]: unknown;
}

// ============================================================
// Net (for connectivity analysis - used in Part 2)
// ============================================================

export interface Net {
  name: string;
  pins: Array<{ reference: string; pin: string; position: Point }>;
  labels: string[];
  wires: Wire[];
}
```

---

## Exceptions (`src/core/exceptions.ts`)

```typescript
// src/core/exceptions.ts

export class KiCadSchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KiCadSchError";
  }
}

export class ParseError extends KiCadSchError {
  constructor(message: string, public line?: number, public column?: number) {
    super(message);
    this.name = "ParseError";
  }
}

export class FormatError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

export class ValidationError extends KiCadSchError {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ElementNotFoundError extends KiCadSchError {
  constructor(elementType: string, identifier: string) {
    super(`${elementType} not found: ${identifier}`);
    this.name = "ElementNotFoundError";
  }
}

export class DuplicateElementError extends KiCadSchError {
  constructor(elementType: string, identifier: string) {
    super(`Duplicate ${elementType}: ${identifier}`);
    this.name = "DuplicateElementError";
  }
}

export class LibraryError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

export class SymbolNotFoundError extends LibraryError {
  constructor(libId: string) {
    super(`Symbol not found: ${libId}`);
    this.name = "SymbolNotFoundError";
  }
}

export class ConnectivityError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "ConnectivityError";
  }
}

export class HierarchyError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "HierarchyError";
  }
}
```

---

## Configuration (`src/core/config.ts`)

```typescript
// src/core/config.ts

export interface GridSettings {
  size: number; // Default: 1.27 (50 mil)
  snapEnabled: boolean;
}

export interface PositioningSettings {
  defaultPropertyOffset: Point;
  referenceOffset: Point;
  valueOffset: Point;
}

export interface ToleranceSettings {
  positionTolerance: number; // Default: 0.001
  angleTolerance: number; // Default: 0.01
}

export interface KiCADConfig {
  grid: GridSettings;
  positioning: PositioningSettings;
  tolerance: ToleranceSettings;
  defaultTextSize: [number, number];
  defaultStrokeWidth: number;
}

export const DEFAULT_CONFIG: KiCADConfig = {
  grid: {
    size: 1.27,
    snapEnabled: true,
  },
  positioning: {
    defaultPropertyOffset: { x: 0, y: 0 },
    referenceOffset: { x: 1.27, y: -1.27 },
    valueOffset: { x: 1.27, y: 1.27 },
  },
  tolerance: {
    positionTolerance: 0.001,
    angleTolerance: 0.01,
  },
  defaultTextSize: [1.27, 1.27],
  defaultStrokeWidth: 0,
};

let globalConfig: KiCADConfig = { ...DEFAULT_CONFIG };

export function getConfig(): KiCADConfig {
  return globalConfig;
}

export function setConfig(config: Partial<KiCADConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

export function resetConfig(): void {
  globalConfig = { ...DEFAULT_CONFIG };
}
```

---

## S-Expression Parser (`src/core/parser.ts`)

Port from `kicad_sch_api/core/parser.py`. This is critical for reading KiCAD files.

```typescript
// src/core/parser.ts

import { ParseError } from "./exceptions";

/**
 * Represents a symbol (atom) in an S-expression.
 * Symbols are unquoted identifiers like `kicad_sch`, `wire`, `at`, etc.
 */
export class Symbol {
  constructor(public readonly name: string) {}

  toString(): string {
    return this.name;
  }
}

export type SExp = Symbol | string | number | boolean | SExp[];

/**
 * Tokenizer for S-expressions.
 */
class Tokenizer {
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(private input: string) {}

  peek(): string | null {
    this.skipWhitespace();
    if (this.pos >= this.input.length) return null;
    return this.input[this.pos];
  }

  next(): string | null {
    this.skipWhitespace();
    if (this.pos >= this.input.length) return null;

    const char = this.input[this.pos];

    if (char === "(" || char === ")") {
      this.advance();
      return char;
    }

    if (char === '"') {
      return this.readString();
    }

    return this.readAtom();
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
      } else if (char === "\n") {
        this.advance();
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private readString(): string {
    let result = "";
    this.advance(); // Skip opening quote

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (char === '"') {
        this.advance(); // Skip closing quote
        return result;
      }

      if (char === "\\") {
        this.advance();
        if (this.pos >= this.input.length) {
          throw new ParseError(
            "Unexpected end of input in string escape",
            this.line,
            this.column
          );
        }
        const escaped = this.input[this.pos];
        switch (escaped) {
          case "n":
            result += "\n";
            break;
          case "t":
            result += "\t";
            break;
          case "r":
            result += "\r";
            break;
          case "\\":
            result += "\\";
            break;
          case '"':
            result += '"';
            break;
          default:
            result += escaped;
        }
        this.advance();
      } else {
        result += char;
        this.advance();
      }
    }

    throw new ParseError("Unterminated string", this.line, this.column);
  }

  private readAtom(): string {
    let result = "";

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (
        char === "(" ||
        char === ")" ||
        char === '"' ||
        char === " " ||
        char === "\t" ||
        char === "\n" ||
        char === "\r"
      ) {
        break;
      }
      result += char;
      this.advance();
    }

    return result;
  }

  getPosition(): { line: number; column: number } {
    return { line: this.line, column: this.column };
  }
}

/**
 * S-expression parser.
 */
export class SExpressionParser {
  parse(input: string): SExp {
    const tokenizer = new Tokenizer(input);
    const result = this.parseExpression(tokenizer);

    // Ensure we've consumed all input
    if (tokenizer.peek() !== null) {
      const pos = tokenizer.getPosition();
      throw new ParseError(
        "Unexpected content after expression",
        pos.line,
        pos.column
      );
    }

    return result;
  }

  private parseExpression(tokenizer: Tokenizer): SExp {
    const token = tokenizer.next();

    if (token === null) {
      throw new ParseError("Unexpected end of input");
    }

    if (token === "(") {
      return this.parseList(tokenizer);
    }

    if (token === ")") {
      throw new ParseError("Unexpected closing parenthesis");
    }

    return this.parseAtom(token);
  }

  private parseList(tokenizer: Tokenizer): SExp[] {
    const list: SExp[] = [];

    while (true) {
      const peek = tokenizer.peek();

      if (peek === null) {
        throw new ParseError("Unexpected end of input in list");
      }

      if (peek === ")") {
        tokenizer.next(); // Consume the ')'
        return list;
      }

      list.push(this.parseExpression(tokenizer));
    }
  }

  private parseAtom(token: string): SExp {
    // Check for boolean
    if (token === "yes" || token === "true") return true;
    if (token === "no" || token === "false") return false;

    // Check for number
    const num = this.tryParseNumber(token);
    if (num !== null) return num;

    // It's a symbol
    return new Symbol(token);
  }

  private tryParseNumber(token: string): number | null {
    // Handle integers
    if (/^-?\d+$/.test(token)) {
      return parseInt(token, 10);
    }

    // Handle floats (including scientific notation)
    if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(token)) {
      return parseFloat(token);
    }

    return null;
  }
}
```

---

## S-Expression Formatter (`src/core/formatter.ts`)

Port from `kicad_sch_api/core/formatter.py`. This is critical for writing KiCAD files with exact format preservation.

```typescript
// src/core/formatter.ts

import { Symbol, SExp } from "./parser";
import { FormatError } from "./exceptions";

/**
 * Elements that should be formatted inline (on a single line).
 */
const INLINE_ELEMENTS = new Set([
  "at",
  "xy",
  "pts",
  "start",
  "end",
  "center",
  "mid",
  "size",
  "stroke",
  "color",
  "fill",
  "font",
  "justify",
  "effects",
  "offset",
  "length",
  "diameter",
  "width",
  "height",
  "thickness",
  "angle",
  "scale",
  "pin",
  "number",
  "name",
  "alternate",
]);

/**
 * Elements that should always be on their own line.
 */
const BLOCK_ELEMENTS = new Set([
  "kicad_sch",
  "lib_symbols",
  "symbol",
  "wire",
  "bus",
  "bus_entry",
  "junction",
  "no_connect",
  "label",
  "global_label",
  "hierarchical_label",
  "text",
  "text_box",
  "rectangle",
  "polyline",
  "circle",
  "arc",
  "sheet",
  "sheet_instances",
  "symbol_instances",
  "image",
  "property",
  "title_block",
  "paper",
  "instances",
  "project",
  "path",
]);

/**
 * Formatter that produces output identical to KiCAD's native format.
 */
export class ExactFormatter {
  private indentChar: string = "\t";

  format(sexp: SExp): string {
    return this.formatElement(sexp, 0).trim();
  }

  private formatElement(sexp: SExp, depth: number): string {
    if (!Array.isArray(sexp)) {
      return this.formatAtom(sexp);
    }

    if (sexp.length === 0) {
      return "()";
    }

    const tag = this.getTag(sexp);
    const isInline = this.shouldBeInline(sexp, tag);

    if (isInline) {
      return this.formatInline(sexp);
    }

    return this.formatBlock(sexp, depth);
  }

  private formatAtom(atom: SExp): string {
    if (atom instanceof Symbol) {
      return atom.name;
    }

    if (typeof atom === "string") {
      return this.formatString(atom);
    }

    if (typeof atom === "number") {
      return this.formatNumber(atom);
    }

    if (typeof atom === "boolean") {
      return atom ? "yes" : "no";
    }

    throw new FormatError(`Unknown atom type: ${typeof atom}`);
  }

  private formatString(str: string): string {
    // Check if string needs quoting
    const needsQuotes =
      str.includes(" ") ||
      str.includes('"') ||
      str.includes("(") ||
      str.includes(")") ||
      str.includes("\n") ||
      str.includes("\t") ||
      str.length === 0;

    if (!needsQuotes) {
      return str;
    }

    // Escape special characters
    const escaped = str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");

    return `"${escaped}"`;
  }

  private formatNumber(num: number): string {
    // KiCAD uses specific formatting for numbers
    if (Number.isInteger(num)) {
      return num.toString();
    }

    // For floats, preserve trailing zeros in certain cases
    // KiCAD typically uses up to 6 decimal places
    const str = num.toFixed(6);

    // Remove unnecessary trailing zeros, but keep at least one decimal place
    // for numbers that should be floats
    return str.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  private formatInline(sexp: SExp[]): string {
    const parts = sexp.map((item) => this.formatElement(item, 0));
    return `(${parts.join(" ")})`;
  }

  private formatBlock(sexp: SExp[], depth: number): string {
    const indent = this.indentChar.repeat(depth);
    const childIndent = this.indentChar.repeat(depth + 1);
    const lines: string[] = [];

    // First element (tag) on same line as opening paren
    const tag = this.formatElement(sexp[0], 0);

    // Check if there are simple attributes that should be on the same line as tag
    const inlineAttrs: string[] = [];
    let i = 1;

    while (i < sexp.length) {
      const item = sexp[i];
      if (this.isSimpleAttribute(item)) {
        inlineAttrs.push(this.formatElement(item, 0));
        i++;
      } else {
        break;
      }
    }

    if (inlineAttrs.length > 0) {
      lines.push(`${indent}(${tag} ${inlineAttrs.join(" ")}`);
    } else {
      lines.push(`${indent}(${tag}`);
    }

    // Remaining elements on their own lines
    for (; i < sexp.length; i++) {
      const item = sexp[i];
      const formatted = this.formatElement(item, depth + 1);

      if (
        Array.isArray(item) &&
        !this.shouldBeInline(item, this.getTag(item))
      ) {
        lines.push(formatted);
      } else {
        lines.push(`${childIndent}${formatted}`);
      }
    }

    // Closing paren
    lines.push(`${indent})`);

    return lines.join("\n");
  }

  private getTag(sexp: SExp[]): string | null {
    if (sexp.length > 0 && sexp[0] instanceof Symbol) {
      return sexp[0].name;
    }
    return null;
  }

  private shouldBeInline(sexp: SExp[], tag: string | null): boolean {
    if (tag && INLINE_ELEMENTS.has(tag)) {
      return true;
    }

    // Short lists without nested lists can be inline
    if (
      sexp.length <= 4 &&
      !sexp.some((item) => Array.isArray(item) && item.length > 3)
    ) {
      return true;
    }

    return false;
  }

  private isSimpleAttribute(item: SExp): boolean {
    // Simple attributes are non-array values or very short arrays
    if (!Array.isArray(item)) {
      return true;
    }

    if (item.length <= 2 && !item.some((i) => Array.isArray(i))) {
      return true;
    }

    return false;
  }
}
```

---

## Base Collection (`src/core/collections/base.ts`)

```typescript
// src/core/collections/base.ts

import { DuplicateElementError, ElementNotFoundError } from "../exceptions";

/**
 * Registry for tracking elements by various indices.
 */
export class IndexRegistry<T> {
  private byUuid: Map<string, T> = new Map();
  private byReference: Map<string, T> = new Map();

  addByUuid(uuid: string, item: T): void {
    if (this.byUuid.has(uuid)) {
      throw new DuplicateElementError("element", uuid);
    }
    this.byUuid.set(uuid, item);
  }

  addByReference(reference: string, item: T): void {
    if (this.byReference.has(reference)) {
      throw new DuplicateElementError("reference", reference);
    }
    this.byReference.set(reference, item);
  }

  getByUuid(uuid: string): T | undefined {
    return this.byUuid.get(uuid);
  }

  getByReference(reference: string): T | undefined {
    return this.byReference.get(reference);
  }

  removeByUuid(uuid: string): boolean {
    return this.byUuid.delete(uuid);
  }

  removeByReference(reference: string): boolean {
    return this.byReference.delete(reference);
  }

  hasUuid(uuid: string): boolean {
    return this.byUuid.has(uuid);
  }

  hasReference(reference: string): boolean {
    return this.byReference.has(reference);
  }

  clear(): void {
    this.byUuid.clear();
    this.byReference.clear();
  }
}

/**
 * Base class for all element collections.
 */
export abstract class BaseCollection<T extends { uuid: string }>
  implements Iterable<T>
{
  protected items: T[] = [];
  protected index: IndexRegistry<T> = new IndexRegistry();
  protected modified: boolean = false;

  get length(): number {
    return this.items.length;
  }

  get isModified(): boolean {
    return this.modified;
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  all(): T[] {
    return [...this.items];
  }

  getByUuid(uuid: string): T | undefined {
    return this.index.getByUuid(uuid);
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  map<U>(fn: (item: T) => U): U[] {
    return this.items.map(fn);
  }

  forEach(fn: (item: T) => void): void {
    this.items.forEach(fn);
  }

  some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  every(predicate: (item: T) => boolean): boolean {
    return this.items.every(predicate);
  }

  protected addItem(item: T): T {
    this.index.addByUuid(item.uuid, item);
    this.items.push(item);
    this.modified = true;
    return item;
  }

  protected removeItem(uuid: string): boolean {
    const idx = this.items.findIndex((item) => item.uuid === uuid);
    if (idx === -1) return false;

    this.items.splice(idx, 1);
    this.index.removeByUuid(uuid);
    this.modified = true;
    return true;
  }

  clear(): void {
    this.items = [];
    this.index.clear();
    this.modified = true;
  }

  resetModified(): void {
    this.modified = false;
  }
}
```

---

## Component Collection (`src/core/collections/component.ts`)

```typescript
// src/core/collections/component.ts

import { randomUUID } from "crypto";
import { BaseCollection, IndexRegistry } from "./base";
import { SchematicSymbol, Point, PropertyValue } from "../types";
import { ElementNotFoundError } from "../exceptions";

/**
 * Wrapper class for a component that provides a convenient API.
 */
export class Component {
  constructor(
    private symbol: SchematicSymbol,
    private collection: ComponentCollection
  ) {}

  get uuid(): string {
    return this.symbol.uuid;
  }
  get libId(): string {
    return this.symbol.libId;
  }
  get position(): Point {
    return this.symbol.position;
  }
  get rotation(): number {
    return this.symbol.rotation;
  }
  get mirror(): "x" | "y" | undefined {
    return this.symbol.mirror;
  }
  get unit(): number {
    return this.symbol.unit;
  }
  get inBom(): boolean {
    return this.symbol.inBom;
  }
  get onBoard(): boolean {
    return this.symbol.onBoard;
  }

  get reference(): string {
    return this.symbol.properties.get("Reference")?.value || "";
  }

  set reference(value: string) {
    const prop = this.symbol.properties.get("Reference");
    if (prop) {
      prop.value = value;
    }
    this.collection.updateReferenceIndex(this.symbol.uuid, value);
  }

  get value(): string {
    return this.symbol.properties.get("Value")?.value || "";
  }

  set value(val: string) {
    const prop = this.symbol.properties.get("Value");
    if (prop) {
      prop.value = val;
    }
  }

  get footprint(): string | undefined {
    return this.symbol.properties.get("Footprint")?.value;
  }

  set footprint(val: string | undefined) {
    if (val) {
      const prop = this.symbol.properties.get("Footprint");
      if (prop) {
        prop.value = val;
      } else {
        this.symbol.properties.set("Footprint", {
          value: val,
          position: { x: 0, y: 0 },
          rotation: 0,
        });
      }
    }
  }

  get properties(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, prop] of this.symbol.properties) {
      result[name] = prop.value;
    }
    return result;
  }

  getProperty(name: string): string | undefined {
    return this.symbol.properties.get(name)?.value;
  }

  setProperty(name: string, value: string): void {
    const existing = this.symbol.properties.get(name);
    if (existing) {
      existing.value = value;
    } else {
      this.symbol.properties.set(name, {
        value,
        position: { x: 0, y: 0 },
        rotation: 0,
      });
    }
  }

  /** Get the raw symbol data for serialization */
  toSymbol(): SchematicSymbol {
    return this.symbol;
  }
}

export interface AddComponentOptions {
  libId: string;
  reference: string;
  value: string;
  position: Point;
  rotation?: number;
  mirror?: "x" | "y";
  unit?: number;
  footprint?: string;
  properties?: Record<string, string>;
  inBom?: boolean;
  onBoard?: boolean;
}

/**
 * Collection of components in a schematic.
 */
export class ComponentCollection extends BaseCollection<Component> {
  private referenceIndex: IndexRegistry<Component> = new IndexRegistry();

  add(options: AddComponentOptions): Component {
    const uuid = randomUUID();

    const properties = new Map<string, PropertyValue>();
    properties.set("Reference", {
      value: options.reference,
      position: { x: options.position.x + 1.27, y: options.position.y - 1.27 },
      rotation: 0,
    });
    properties.set("Value", {
      value: options.value,
      position: { x: options.position.x + 1.27, y: options.position.y + 1.27 },
      rotation: 0,
    });

    if (options.footprint) {
      properties.set("Footprint", {
        value: options.footprint,
        position: { x: options.position.x, y: options.position.y + 2.54 },
        rotation: 0,
      });
    }

    if (options.properties) {
      for (const [name, value] of Object.entries(options.properties)) {
        if (!properties.has(name)) {
          properties.set(name, {
            value,
            position: { x: 0, y: 0 },
            rotation: 0,
          });
        }
      }
    }

    const symbol: SchematicSymbol = {
      uuid,
      libId: options.libId,
      position: options.position,
      rotation: options.rotation || 0,
      mirror: options.mirror,
      unit: options.unit || 1,
      inBom: options.inBom !== false,
      onBoard: options.onBoard !== false,
      excludeFromSim: false,
      dnp: false,
      properties,
      pins: new Map(),
    };

    const component = new Component(symbol, this);
    this.addItem(component);
    this.referenceIndex.addByReference(options.reference, component);

    return component;
  }

  get(reference: string): Component | undefined {
    return this.referenceIndex.getByReference(reference);
  }

  remove(reference: string): boolean {
    const component = this.get(reference);
    if (!component) return false;

    this.referenceIndex.removeByReference(reference);
    return this.removeItem(component.uuid);
  }

  findByLibId(libId: string): Component[] {
    return this.filter((c) => c.libId === libId);
  }

  updateReferenceIndex(uuid: string, newReference: string): void {
    const component = this.getByUuid(uuid);
    if (component) {
      // Remove old reference
      for (const [ref, comp] of (this.referenceIndex as any).byReference) {
        if (comp.uuid === uuid) {
          this.referenceIndex.removeByReference(ref);
          break;
        }
      }
      // Add new reference
      this.referenceIndex.addByReference(newReference, component);
    }
  }

  /** Add a component from raw symbol data (used during parsing) */
  addFromSymbol(symbol: SchematicSymbol): Component {
    const component = new Component(symbol, this);
    this.addItem(component);

    const reference = symbol.properties.get("Reference")?.value;
    if (reference) {
      this.referenceIndex.addByReference(reference, component);
    }

    return component;
  }
}
```

---

## Wire Collection (`src/core/collections/wire.ts`)

```typescript
// src/core/collections/wire.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Wire, Point, Stroke, StrokeType } from "../types";

export interface AddWireOptions {
  start?: Point;
  end?: Point;
  points?: Point[];
  stroke?: Stroke;
}

export class WireCollection extends BaseCollection<Wire> {
  add(options: AddWireOptions): Wire {
    let points: Point[];

    if (options.points) {
      points = options.points;
    } else if (options.start && options.end) {
      points = [options.start, options.end];
    } else {
      throw new Error("Must provide either points array or start/end");
    }

    const wire: Wire = {
      uuid: randomUUID(),
      points,
      stroke: options.stroke || {
        width: 0,
        type: StrokeType.DEFAULT,
      },
    };

    return this.addItem(wire);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  findAtPoint(point: Point, tolerance: number = 0.01): Wire[] {
    return this.filter((wire) =>
      wire.points.some(
        (p) =>
          Math.abs(p.x - point.x) < tolerance &&
          Math.abs(p.y - point.y) < tolerance
      )
    );
  }
}
```

---

## Label Collection (`src/core/collections/label.ts`)

```typescript
// src/core/collections/label.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import {
  Label,
  GlobalLabel,
  HierarchicalLabel,
  LabelType,
  HierarchicalLabelShape,
  Point,
  TextEffects,
  PropertyValue,
} from "../types";

type AnyLabel = Label | GlobalLabel | HierarchicalLabel;

export interface AddLabelOptions {
  text: string;
  position: Point;
  rotation?: number;
  type?: LabelType;
  shape?: HierarchicalLabelShape;
  effects?: TextEffects;
}

export class LabelCollection extends BaseCollection<AnyLabel> {
  add(options: AddLabelOptions): AnyLabel {
    const uuid = randomUUID();
    const type = options.type || LabelType.LOCAL;

    if (type === LabelType.GLOBAL) {
      const label: GlobalLabel = {
        uuid,
        text: options.text,
        position: options.position,
        rotation: options.rotation || 0,
        effects: options.effects,
        shape: options.shape || HierarchicalLabelShape.BIDIRECTIONAL,
        properties: new Map(),
      };
      return this.addItem(label);
    }

    if (type === LabelType.HIERARCHICAL) {
      const label: HierarchicalLabel = {
        uuid,
        text: options.text,
        position: options.position,
        rotation: options.rotation || 0,
        effects: options.effects,
        shape: options.shape || HierarchicalLabelShape.BIDIRECTIONAL,
      };
      return this.addItem(label);
    }

    const label: Label = {
      uuid,
      text: options.text,
      position: options.position,
      rotation: options.rotation || 0,
      effects: options.effects,
    };
    return this.addItem(label);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  getLocalLabels(): Label[] {
    return this.filter((l) => !("shape" in l)) as Label[];
  }

  getGlobalLabels(): GlobalLabel[] {
    return this.filter(
      (l) => "shape" in l && "properties" in l
    ) as GlobalLabel[];
  }

  getHierarchicalLabels(): HierarchicalLabel[] {
    return this.filter(
      (l) => "shape" in l && !("properties" in l)
    ) as HierarchicalLabel[];
  }

  findByText(text: string): AnyLabel[] {
    return this.filter((l) => l.text === text);
  }
}
```

---

## Junction Collection (`src/core/collections/junction.ts`)

```typescript
// src/core/collections/junction.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Junction, Point } from "../types";

export interface AddJunctionOptions {
  position: Point;
  diameter?: number;
  color?: [number, number, number, number];
}

export class JunctionCollection extends BaseCollection<Junction> {
  add(options: AddJunctionOptions): Junction {
    const junction: Junction = {
      uuid: randomUUID(),
      position: options.position,
      diameter: options.diameter || 0,
      color: options.color || [0, 0, 0, 0],
    };
    return this.addItem(junction);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  findAtPoint(point: Point, tolerance: number = 0.01): Junction | undefined {
    return this.find(
      (j) =>
        Math.abs(j.position.x - point.x) < tolerance &&
        Math.abs(j.position.y - point.y) < tolerance
    );
  }
}
```

---

## Phased Success Criteria (Part 1)

### Phase 1: Project Setup

- [x] Initialize npm project with TypeScript (`npm init -y && npm install typescript ts-jest jest @types/jest @types/node --save-dev`)
- [x] Configure `tsconfig.json` for ES modules with strict mode
- [x] Configure `jest.config.js` for ts-jest
- [x] Create directory structure as shown above
- [x] Copy reference test fixtures from Python project's `tests/reference_kicad_projects/`

### Phase 2: Core Types & Exceptions

- [x] Implement all interfaces in `src/core/types.ts` (copy from above)
- [x] Implement all enums (PinType, WireType, LabelType, etc.)
- [x] Implement all exception classes in `src/core/exceptions.ts`
- [x] Implement configuration in `src/core/config.ts`

### Phase 3: S-Expression Parser

- [x] Implement `Symbol` class for S-expression atoms
- [x] Implement `Tokenizer` class for lexing
- [x] Implement `SExpressionParser` class
- [x] Handle strings with escape sequences
- [x] Handle numbers (integers, floats)
- [x] Handle nested lists
- [x] Pass unit tests for parsing

### Phase 4: S-Expression Formatter

- [x] Implement `ExactFormatter` class
- [x] Handle inline vs block elements correctly
- [x] Handle proper indentation with tabs
- [x] Handle string quoting and escaping
- [x] Handle number formatting
- [x] Pass unit tests for formatting

### Phase 5: Collections

- [x] Implement `IndexRegistry` and `BaseCollection`
- [x] Implement `ComponentCollection` with `Component` wrapper
- [x] Implement `WireCollection`
- [x] Implement `LabelCollection` (local, global, hierarchical)
- [x] Implement `JunctionCollection`
- [x] Implement `NoConnectCollection`
- [x] Implement `BusCollection`, `BusEntryCollection`
- [x] Implement `SheetCollection`
- [x] Implement `TextCollection`, `TextBoxCollection`
- [x] Implement `RectangleCollection`, `ImageCollection`

### Phase 6: Schematic Class (Core)

- [x] Implement basic `Schematic` class structure
- [x] Implement `load`, `create`, `fromString` factory methods
- [x] Implement `parse` method that delegates to element parsers
- [x] Implement element parsers in `src/core/parsers/`
- [x] Implement `toSexp` method for serialization
- [x] Implement `format` method using `ExactFormatter`
- [x] Implement `save` method

### Phase 7: Round-Trip Integration

- [x] All round-trip tests pass for `blank.kicad_sch`
- [x] All round-trip tests pass for `single_resistor.kicad_sch`
- [x] All round-trip tests pass for all rotated resistor variants
- [x] Component add/modify operations work correctly
- [x] Wire add operations work correctly
- [x] Label add operations work correctly

---

## Mandatory Test Cases (Part 1)

### Test 1: S-Expression Parser

```typescript
// test/unit/parser.test.ts
import { SExpressionParser, Symbol } from "../../src/core/parser";

describe("SExpressionParser", () => {
  const parser = new SExpressionParser();

  it("should parse a simple list", () => {
    const result = parser.parse("(hello world)");
    expect(result).toEqual([new Symbol("hello"), new Symbol("world")]);
  });

  it("should parse nested lists", () => {
    const result = parser.parse("(a (b c) d)");
    expect(result).toEqual([
      new Symbol("a"),
      [new Symbol("b"), new Symbol("c")],
      new Symbol("d"),
    ]);
  });

  it("should parse numbers", () => {
    const result = parser.parse("(num 42 3.14 -5)");
    expect(result).toEqual([new Symbol("num"), 42, 3.14, -5]);
  });

  it("should parse strings with escapes", () => {
    const result = parser.parse('(text "hello\\"world")');
    expect(result).toEqual([new Symbol("text"), 'hello"world']);
  });

  it("should parse booleans", () => {
    const result = parser.parse("(flags yes no)");
    expect(result).toEqual([new Symbol("flags"), true, false]);
  });
});
```

### Test 2: Round-Trip Blank Schematic

```typescript
// test/integration/round-trip.test.ts
import { readFileSync } from "fs";
import { Schematic } from "../../src";

describe("Round-Trip Tests", () => {
  it("should round-trip blank schematic exactly", () => {
    const original = readFileSync(
      "test/fixtures/blank/blank.kicad_sch",
      "utf-8"
    );
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output).toEqual(original.trim());
  });
});
```

### Test 3: Round-Trip Single Resistor

```typescript
it("should round-trip single resistor schematic", () => {
  const original = readFileSync(
    "test/fixtures/single_resistor/single_resistor.kicad_sch",
    "utf-8"
  );
  const sch = Schematic.fromString(original);
  const output = sch.format();
  expect(output).toEqual(original.trim());
});
```

### Test 4: Round-Trip All Rotations

```typescript
const rotations = ["0deg", "90deg", "180deg", "270deg"];
rotations.forEach((rot) => {
  it(`should round-trip rotated_resistor_${rot}`, () => {
    const original = readFileSync(
      `test/fixtures/rotated_resistor_${rot}/rotated_resistor_${rot}.kicad_sch`,
      "utf-8"
    );
    const sch = Schematic.fromString(original);
    const output = sch.format();
    expect(output).toEqual(original.trim());
  });
});
```

### Test 5: Add Component

```typescript
describe("Component Operations", () => {
  it("should add a component", () => {
    const sch = Schematic.create("Test");

    const component = sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.33, y: 101.6 },
    });

    expect(component.reference).toBe("R1");
    expect(component.value).toBe("10k");
    expect(component.libId).toBe("Device:R");
  });

  it("should modify component properties", () => {
    const sch = Schematic.create("Test");

    const component = sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100.33, y: 101.6 },
    });

    component.value = "20k";
    component.setProperty("Tolerance", "1%");

    expect(component.value).toBe("20k");
    expect(component.getProperty("Tolerance")).toBe("1%");
  });
});
```

### Test 6: Add Wire

```typescript
describe("Wire Operations", () => {
  it("should add a wire", () => {
    const sch = Schematic.create("Test");

    const wire = sch.wires.add({
      start: { x: 100.33, y: 101.6 },
      end: { x: 106.68, y: 101.6 },
    });

    expect(wire.points).toHaveLength(2);
    expect(wire.points[0]).toEqual({ x: 100.33, y: 101.6 });
  });
});
```

### Test 7: Add Label

```typescript
describe("Label Operations", () => {
  it("should add a local label", () => {
    const sch = Schematic.create("Test");

    const label = sch.labels.add({
      text: "VCC",
      position: { x: 100.33, y: 101.6 },
    });

    expect(label.text).toBe("VCC");
  });
});
```

### Test 8: Grid Alignment

```typescript
describe("Grid Alignment", () => {
  it("should snap to grid", () => {
    const { snapToGrid } = require("../../src/core/config");

    const point = snapToGrid({ x: 100.5, y: 101.3 });
    // 100.5 / 1.27 = 79.13 -> round to 79 -> 79 * 1.27 = 100.33
    // 101.3 / 1.27 = 79.76 -> round to 80 -> 80 * 1.27 = 101.6
    expect(point.x).toBeCloseTo(100.33, 2);
    expect(point.y).toBeCloseTo(101.6, 2);
  });
});
```

---

## ⚠️ Traps to Avoid (Part 1)

1. **S-Expression Formatting:** KiCAD is VERY particular. Use tabs for indentation, not spaces. Preserve trailing zeros on floats where needed.

2. **String Escaping:** Strings may contain `\n`, `\"`, `\\`. Handle these correctly in both parsing and formatting.

3. **Element Ordering:** The order of elements in the output must match the original. Use the `FormatSyncManager` pattern from the Python code if needed.

4. **UUID Generation:** Use `crypto.randomUUID()` for generating UUIDs.

5. **Number Formatting:** Integers should not have decimal points. Floats should not have unnecessary trailing zeros.

---

## Agent Instructions

1. **Focus on Fidelity:** The only goal of Part 1 is perfect parsing and formatting. Do not implement analysis features.
2. **Run Tests Constantly:** The round-trip tests are your ground truth.
3. **Refer to Python Code:** Use `parser.py`, `formatter.py`, and `schematic.py` as your guide.
4. **Signal Completion:** When all tests pass, output:
   ```
   ✅ PART 1 COMPLETE: Core Engine ready. All round-trip tests passing.
   ```
