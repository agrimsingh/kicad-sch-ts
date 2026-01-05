---
task: "Port kicad-sch-api to TypeScript - Part 2: Library & Analysis"
test_command: "npm test"
completion_criteria:
  - Symbol Library Cache can discover, parse, and search all KiCAD libraries
  - Geometry module can calculate bounding boxes and create orthogonal routes
  - Connectivity analysis can identify nets and check pin connections
  - Hierarchy management can build a tree and validate sheet pins
  - Validation/ERC system can detect common errors
  - BOM and Discovery modules are fully functional
  - Python code exporter can generate valid code
  - All analysis-related tests pass
max_iterations: 150
---

# Task: Port `kicad-sch-api` to TypeScript - Part 2: Library & Analysis

This is **Part 2 of 3**. This part builds upon the Core Engine from Part 1 to add library management, geometry calculations, connectivity analysis, validation, and export capabilities.

## Prerequisite

**Part 1 must be complete.** The Core Engine must be able to parse and format schematics with perfect fidelity before starting this part. Verify by running `npm test` and ensuring all round-trip tests pass.

## The One-Line Success Criterion for Part 2

The library must be able to perform complex analysis on any loaded schematic, including full Electrical Rules Checking (ERC), connectivity tracing, hierarchy validation, and Bill of Materials (BOM) auditing.

---

## Source Reference

Key Python files for Part 2:

- `kicad_sch_api/library/cache.py` (~1430 lines)
- `kicad_sch_api/geometry/routing.py` (~202 lines)
- `kicad_sch_api/geometry/symbol_bbox.py` (~608 lines)
- `kicad_sch_api/validation/erc.py` (~167 lines)
- `kicad_sch_api/validation/pin_matrix.py` (~242 lines)
- `kicad_sch_api/bom/auditor.py` (~297 lines)
- `kicad_sch_api/discovery/search_index.py` (~456 lines)
- `kicad_sch_api/exporters/python_generator.py` (~607 lines)
- `kicad_sch_api/core/managers/hierarchy.py` (~662 lines)

---

## File Structure (Part 2 Additions)

```
kicad-sch-ts/
├── src/
│   ├── library/
│   │   ├── cache.ts              # SymbolLibraryCache
│   │   └── index.ts
│   ├── geometry/
│   │   ├── routing.ts            # Orthogonal routing
│   │   ├── symbol-bbox.ts        # Bounding box calculations
│   │   ├── font-metrics.ts       # Font/text metrics constants
│   │   └── index.ts
│   ├── connectivity/
│   │   ├── analyzer.ts           # Net analysis
│   │   └── index.ts
│   ├── validation/
│   │   ├── erc-models.ts         # ERC types
│   │   ├── pin-matrix.ts         # Pin conflict matrix
│   │   ├── erc.ts                # ElectricalRulesChecker
│   │   └── index.ts
│   ├── bom/
│   │   ├── auditor.ts            # BOMPropertyAuditor
│   │   ├── matcher.ts            # PropertyMatcher
│   │   └── index.ts
│   ├── discovery/
│   │   ├── search-index.ts       # SQLite-based search
│   │   └── index.ts
│   ├── exporters/
│   │   ├── python-generator.ts   # PythonCodeGenerator
│   │   └── index.ts
│   └── core/
│       └── managers/
│           ├── hierarchy.ts      # HierarchyManager (ADD)
│           ├── wire.ts           # WireManager (ADD)
│           └── index.ts
└── test/
    └── integration/
        ├── library.test.ts
        ├── geometry.test.ts
        ├── connectivity.test.ts
        ├── erc.test.ts
        └── bom.test.ts
```

---

## Additional Dependencies (Part 2)

Add these to `package.json`:

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.5"
  }
}
```

---

## Symbol Library Cache (`src/library/cache.ts`)

Port from `kicad_sch_api/library/cache.py`. This provides access to KiCAD's symbol libraries.

```typescript
// src/library/cache.ts

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { SExpressionParser, Symbol as SSymbol } from "../core/parser";
import {
  SymbolDefinition,
  SymbolUnit,
  SymbolPin,
  PinType,
  PinShape,
  Point,
} from "../core/types";
import { LibraryError } from "../core/exceptions";

export interface LibraryStats {
  symbolCount: number;
  loadTime: number;
  lastAccessed: number;
}

export class SymbolLibraryCache {
  private symbolCache: Map<string, SymbolDefinition> = new Map();
  private libraryIndex: Map<string, string[]> = new Map();
  private libraryPaths: string[] = [];
  private libStats: Map<string, LibraryStats> = new Map();
  private parser: SExpressionParser = new SExpressionParser();

  constructor() {
    this.discoverLibraryPaths();
  }

  /**
   * Discover KiCAD library paths from environment and standard locations.
   */
  private discoverLibraryPaths(): void {
    const paths: string[] = [];

    // Check environment variables
    const envVars = [
      "KICAD_SYMBOL_DIR",
      "KICAD8_SYMBOL_DIR",
      "KICAD7_SYMBOL_DIR",
    ];
    for (const envVar of envVars) {
      const path = process.env[envVar];
      if (path && existsSync(path)) {
        paths.push(path);
      }
    }

    // Standard locations by platform
    const platform = process.platform;
    const standardPaths: string[] = [];

    if (platform === "darwin") {
      standardPaths.push(
        "/Applications/KiCad/KiCad.app/Contents/SharedSupport/symbols",
        join(homedir(), "Library/Application Support/kicad/8.0/symbols"),
        join(homedir(), "Library/Application Support/kicad/7.0/symbols")
      );
    } else if (platform === "win32") {
      standardPaths.push(
        "C:\\Program Files\\KiCad\\8.0\\share\\kicad\\symbols",
        "C:\\Program Files\\KiCad\\7.0\\share\\kicad\\symbols"
      );
    } else {
      // Linux
      standardPaths.push(
        "/usr/share/kicad/symbols",
        "/usr/local/share/kicad/symbols",
        join(homedir(), ".local/share/kicad/8.0/symbols"),
        join(homedir(), ".local/share/kicad/7.0/symbols")
      );
    }

    for (const path of standardPaths) {
      if (existsSync(path) && !paths.includes(path)) {
        paths.push(path);
      }
    }

    this.libraryPaths = paths;
  }

  /**
   * Add a custom library path.
   */
  addLibraryPath(path: string): void {
    if (existsSync(path) && !this.libraryPaths.includes(path)) {
      this.libraryPaths.push(path);
    }
  }

  /**
   * Get all available library names.
   */
  getLibraryNames(): string[] {
    const names = new Set<string>();

    for (const libPath of this.libraryPaths) {
      try {
        const files = readdirSync(libPath);
        for (const file of files) {
          if (file.endsWith(".kicad_sym")) {
            names.add(basename(file, ".kicad_sym"));
          }
        }
      } catch (e) {
        // Directory not readable
      }
    }

    return Array.from(names).sort();
  }

  /**
   * Get a symbol by lib_id (e.g., "Device:R").
   */
  getSymbol(libId: string): SymbolDefinition | undefined {
    if (this.symbolCache.has(libId)) {
      return this.symbolCache.get(libId);
    }

    const [libraryName, symbolName] = libId.split(":");
    if (!libraryName || !symbolName) {
      return undefined;
    }

    if (!this.libraryIndex.has(libraryName)) {
      this.loadLibrary(libraryName);
    }

    return this.symbolCache.get(libId);
  }

  /**
   * Load a library file and cache all its symbols.
   */
  private loadLibrary(libraryName: string): void {
    const startTime = Date.now();
    const filename = `${libraryName}.kicad_sym`;

    for (const libPath of this.libraryPaths) {
      const fullPath = join(libPath, filename);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const symbols = this.parseLibraryFile(content, libraryName);

          const symbolNames: string[] = [];
          for (const symbol of symbols) {
            const libId = `${libraryName}:${symbol.name}`;
            symbol.libId = libId;
            symbol.library = libraryName;
            this.symbolCache.set(libId, symbol);
            symbolNames.push(symbol.name);
          }

          this.libraryIndex.set(libraryName, symbolNames);
          this.libStats.set(libraryName, {
            symbolCount: symbols.length,
            loadTime: Date.now() - startTime,
            lastAccessed: Date.now(),
          });

          return;
        } catch (e) {
          console.error(`Error loading library ${libraryName}:`, e);
        }
      }
    }
  }

  /**
   * Parse a .kicad_sym library file.
   */
  private parseLibraryFile(
    content: string,
    libraryName: string
  ): SymbolDefinition[] {
    const sexp = this.parser.parse(content) as any[];

    if (
      !Array.isArray(sexp) ||
      !(sexp[0] instanceof SSymbol) ||
      sexp[0].name !== "kicad_symbol_lib"
    ) {
      throw new LibraryError("Invalid symbol library file");
    }

    const symbols: SymbolDefinition[] = [];

    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof SSymbol &&
        item[0].name === "symbol"
      ) {
        const symbol = this.parseSymbolDefinition(item, libraryName);
        symbols.push(symbol);
      }
    }

    return symbols;
  }

  /**
   * Parse a symbol definition from S-expression.
   */
  private parseSymbolDefinition(
    sexp: any[],
    libraryName: string
  ): SymbolDefinition {
    const name = sexp[1] as string;

    const symbol: SymbolDefinition = {
      libId: `${libraryName}:${name}`,
      name,
      library: libraryName,
      referencePrefix: "U",
      description: "",
      keywords: "",
      datasheet: "",
      unitCount: 1,
      unitsLocked: false,
      isPower: false,
      pinNames: { offset: 0.508, hide: false },
      pinNumbers: { hide: false },
      inBom: true,
      onBoard: true,
      properties: new Map(),
      units: new Map(),
    };

    for (let i = 2; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof SSymbol)) continue;

      const tag = item[0].name;
      switch (tag) {
        case "property":
          this.parseSymbolProperty(item, symbol);
          break;
        case "power":
          symbol.isPower = true;
          break;
        case "pin_names":
          this.parsePinNames(item, symbol);
          break;
        case "pin_numbers":
          if (
            item.some((x: any) => x instanceof SSymbol && x.name === "hide")
          ) {
            symbol.pinNumbers.hide = true;
          }
          break;
        case "in_bom":
          symbol.inBom = item[1] === "yes" || item[1] === true;
          break;
        case "on_board":
          symbol.onBoard = item[1] === "yes" || item[1] === true;
          break;
        case "symbol":
          this.parseSymbolUnit(item, symbol);
          break;
      }
    }

    return symbol;
  }

  private parseSymbolProperty(sexp: any[], symbol: SymbolDefinition): void {
    const name = sexp[1] as string;
    const value = sexp[2] as string;

    switch (name) {
      case "Reference":
        symbol.referencePrefix = value.replace(/[0-9]/g, "");
        break;
      case "ki_description":
        symbol.description = value;
        break;
      case "ki_keywords":
        symbol.keywords = value;
        break;
      case "Datasheet":
        symbol.datasheet = value;
        break;
    }

    symbol.properties.set(name, {
      value,
      position: { x: 0, y: 0 },
      rotation: 0,
    });
  }

  private parsePinNames(sexp: any[], symbol: SymbolDefinition): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof SSymbol &&
        item[0].name === "offset"
      ) {
        symbol.pinNames.offset = item[1] as number;
      } else if (item instanceof SSymbol && item.name === "hide") {
        symbol.pinNames.hide = true;
      }
    }
  }

  private parseSymbolUnit(sexp: any[], symbol: SymbolDefinition): void {
    const unitName = sexp[1] as string;
    const parts = unitName.split("_");
    const unitNumber = parseInt(parts[parts.length - 2]) || 0;
    const style = parseInt(parts[parts.length - 1]) || 1;

    if (!symbol.units.has(unitNumber)) {
      symbol.units.set(unitNumber, {
        unitNumber,
        style,
        graphics: [],
        pins: [],
      });
    }

    const unit = symbol.units.get(unitNumber)!;

    for (let i = 2; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof SSymbol)) continue;

      const tag = item[0].name;
      if (tag === "pin") {
        unit.pins.push(this.parsePin(item));
      }
    }

    symbol.unitCount = Math.max(symbol.unitCount, unitNumber + 1);
  }

  private parsePin(sexp: any[]): SymbolPin {
    const electricalType = sexp[1] as string;
    const graphicStyle = sexp[2] as string;

    const pin: SymbolPin = {
      number: "",
      name: "",
      position: { x: 0, y: 0 },
      length: 2.54,
      rotation: 0,
      electricalType: electricalType as PinType,
      graphicStyle: graphicStyle as PinShape,
      hide: false,
      alternate: [],
    };

    for (let i = 3; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof SSymbol)) continue;

      const tag = item[0].name;
      switch (tag) {
        case "at":
          pin.position = { x: item[1] as number, y: item[2] as number };
          pin.rotation = (item[3] as number) || 0;
          break;
        case "length":
          pin.length = item[1] as number;
          break;
        case "name":
          pin.name = item[1] as string;
          break;
        case "number":
          pin.number = item[1] as string;
          break;
        case "hide":
          pin.hide = true;
          break;
      }
    }

    return pin;
  }

  /**
   * Search for symbols by name or keywords.
   */
  searchSymbols(query: string, limit: number = 50): SymbolDefinition[] {
    const results: SymbolDefinition[] = [];
    const queryLower = query.toLowerCase();

    for (const libName of this.getLibraryNames()) {
      if (!this.libraryIndex.has(libName)) {
        this.loadLibrary(libName);
      }
    }

    for (const symbol of this.symbolCache.values()) {
      if (results.length >= limit) break;

      const nameMatch = symbol.name.toLowerCase().includes(queryLower);
      const descMatch = symbol.description.toLowerCase().includes(queryLower);
      const keywordMatch = symbol.keywords.toLowerCase().includes(queryLower);

      if (nameMatch || descMatch || keywordMatch) {
        results.push(symbol);
      }
    }

    return results;
  }

  /**
   * Get all symbols in a library.
   */
  getLibrarySymbols(libraryName: string): SymbolDefinition[] {
    if (!this.libraryIndex.has(libraryName)) {
      this.loadLibrary(libraryName);
    }

    const symbolNames = this.libraryIndex.get(libraryName) || [];
    return symbolNames
      .map((name) => this.symbolCache.get(`${libraryName}:${name}`))
      .filter(Boolean) as SymbolDefinition[];
  }

  getPerformanceStats(): {
    totalSymbolsCached: number;
    totalLibrariesLoaded: number;
    libraryStats: Map<string, LibraryStats>;
  } {
    return {
      totalSymbolsCached: this.symbolCache.size,
      totalLibrariesLoaded: this.libraryIndex.size,
      libraryStats: this.libStats,
    };
  }
}

// Global cache instance
let globalCache: SymbolLibraryCache | undefined;

export function getSymbolCache(): SymbolLibraryCache {
  if (!globalCache) {
    globalCache = new SymbolLibraryCache();
  }
  return globalCache;
}

export function getSymbolInfo(libId: string): SymbolDefinition | undefined {
  return getSymbolCache().getSymbol(libId);
}

export function searchSymbols(
  query: string,
  limit?: number
): SymbolDefinition[] {
  return getSymbolCache().searchSymbols(query, limit);
}
```

---

## Geometry: Routing (`src/geometry/routing.ts`)

```typescript
// src/geometry/routing.ts

import { Point } from "../core/types";

const GRID_SIZE = 1.27;

export function snapToGrid(point: Point): Point {
  return {
    x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
  };
}

export enum CornerDirection {
  AUTO = "auto",
  HORIZONTAL_FIRST = "horizontal_first",
  VERTICAL_FIRST = "vertical_first",
}

export interface RoutingResult {
  segments: Array<{ start: Point; end: Point }>;
  corner?: Point;
  isDirectRoute: boolean;
}

/**
 * Create orthogonal (Manhattan) routing between two points.
 *
 * CRITICAL: Remember KiCAD Y-axis is INVERTED in schematic space.
 */
export function createOrthogonalRouting(
  fromPos: Point,
  toPos: Point,
  cornerDirection: CornerDirection = CornerDirection.AUTO
): RoutingResult {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;

  // Check for direct routing (aligned on same axis)
  if (Math.abs(dx) < 0.01) {
    return {
      segments: [{ start: fromPos, end: toPos }],
      isDirectRoute: true,
    };
  }

  if (Math.abs(dy) < 0.01) {
    return {
      segments: [{ start: fromPos, end: toPos }],
      isDirectRoute: true,
    };
  }

  // Need L-shaped routing
  let corner: Point;

  if (cornerDirection === CornerDirection.AUTO) {
    cornerDirection =
      Math.abs(dx) >= Math.abs(dy)
        ? CornerDirection.HORIZONTAL_FIRST
        : CornerDirection.VERTICAL_FIRST;
  }

  if (cornerDirection === CornerDirection.HORIZONTAL_FIRST) {
    corner = { x: toPos.x, y: fromPos.y };
  } else {
    corner = { x: fromPos.x, y: toPos.y };
  }

  corner = snapToGrid(corner);

  return {
    segments: [
      { start: fromPos, end: corner },
      { start: corner, end: toPos },
    ],
    corner,
    isDirectRoute: false,
  };
}

export function validateRoutingResult(result: RoutingResult): boolean {
  if (result.segments.length === 0) return false;

  for (let i = 0; i < result.segments.length - 1; i++) {
    const end = result.segments[i].end;
    const nextStart = result.segments[i + 1].start;

    if (
      Math.abs(end.x - nextStart.x) > 0.01 ||
      Math.abs(end.y - nextStart.y) > 0.01
    ) {
      return false;
    }
  }

  return true;
}
```

---

## Geometry: Bounding Box (`src/geometry/symbol-bbox.ts`)

```typescript
// src/geometry/symbol-bbox.ts

import { Point, SymbolDefinition, SymbolPin } from "../core/types";
import { Component } from "../core/collections/component";
import { SymbolLibraryCache } from "../library/cache";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function createBoundingBox(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): BoundingBox {
  return { minX, minY, maxX, maxY };
}

export function getBoundingBoxWidth(bbox: BoundingBox): number {
  return bbox.maxX - bbox.minX;
}

export function getBoundingBoxHeight(bbox: BoundingBox): number {
  return bbox.maxY - bbox.minY;
}

export function getBoundingBoxCenter(bbox: BoundingBox): Point {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
}

export function expandBoundingBox(
  bbox: BoundingBox,
  margin: number
): BoundingBox {
  return {
    minX: bbox.minX - margin,
    minY: bbox.minY - margin,
    maxX: bbox.maxX + margin,
    maxY: bbox.maxY + margin,
  };
}

export function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

const DEFAULT_TEXT_HEIGHT = 2.54;
const DEFAULT_PIN_TEXT_WIDTH_RATIO = 2.0;
const DEFAULT_PIN_NUMBER_SIZE = 1.27;

export class SymbolBoundingBoxCalculator {
  static calculateBoundingBox(
    symbol: SymbolDefinition,
    includeProperties: boolean = true
  ): BoundingBox {
    if (!symbol) {
      return createBoundingBox(-2.54, -2.54, 2.54, 2.54);
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const unit of symbol.units.values()) {
      for (const pin of unit.pins) {
        const pinBbox = this.getPinBounds(pin);
        minX = Math.min(minX, pinBbox.minX);
        minY = Math.min(minY, pinBbox.minY);
        maxX = Math.max(maxX, pinBbox.maxX);
        maxY = Math.max(maxY, pinBbox.maxY);
      }
    }

    if (includeProperties) {
      minY -= DEFAULT_TEXT_HEIGHT * 1.5;
      maxY += DEFAULT_TEXT_HEIGHT * 1.5;
    }

    if (!isFinite(minX)) {
      return createBoundingBox(-2.54, -2.54, 2.54, 2.54);
    }

    return createBoundingBox(minX, minY, maxX, maxY);
  }

  private static getPinBounds(pin: SymbolPin): BoundingBox {
    const pos = pin.position;
    const length = pin.length;
    const rotation = pin.rotation;

    let endX = pos.x;
    let endY = pos.y;

    switch (rotation) {
      case 0:
        endX = pos.x + length;
        break;
      case 90:
        endY = pos.y + length;
        break;
      case 180:
        endX = pos.x - length;
        break;
      case 270:
        endY = pos.y - length;
        break;
    }

    const textWidth = Math.max(
      pin.name.length * DEFAULT_PIN_TEXT_WIDTH_RATIO * DEFAULT_PIN_NUMBER_SIZE,
      pin.number.length * DEFAULT_PIN_TEXT_WIDTH_RATIO * DEFAULT_PIN_NUMBER_SIZE
    );

    const minX = Math.min(pos.x, endX) - textWidth / 2;
    const maxX = Math.max(pos.x, endX) + textWidth / 2;
    const minY = Math.min(pos.y, endY) - DEFAULT_PIN_NUMBER_SIZE;
    const maxY = Math.max(pos.y, endY) + DEFAULT_PIN_NUMBER_SIZE;

    return createBoundingBox(minX, minY, maxX, maxY);
  }
}

/**
 * Get bounding box for a placed component in schematic space.
 */
export function getComponentBoundingBox(
  component: Component,
  symbolCache?: SymbolLibraryCache,
  includeProperties: boolean = true
): BoundingBox | null {
  const symbolDef = symbolCache?.getSymbol(component.libId);
  if (!symbolDef) return null;

  const symbolBbox = SymbolBoundingBoxCalculator.calculateBoundingBox(
    symbolDef,
    includeProperties
  );

  return transformBoundingBox(
    symbolBbox,
    component.position,
    component.rotation,
    component.mirror
  );
}

function transformBoundingBox(
  bbox: BoundingBox,
  position: Point,
  rotation: number,
  mirror?: "x" | "y"
): BoundingBox {
  const corners: Point[] = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];

  const transformed = corners.map((corner) => {
    let x = corner.x;
    let y = -corner.y; // Y-negation for symbol-to-schematic

    if (mirror === "x") x = -x;
    if (mirror === "y") y = -y;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotX = x * cos - y * sin;
    const rotY = x * sin + y * cos;

    return {
      x: position.x + rotX,
      y: position.y + rotY,
    };
  });

  let minX = transformed[0].x,
    maxX = transformed[0].x;
  let minY = transformed[0].y,
    maxY = transformed[0].y;
  for (const p of transformed) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return createBoundingBox(minX, minY, maxX, maxY);
}
```

---

## Validation: ERC (`src/validation/erc.ts`)

```typescript
// src/validation/erc.ts

import { Schematic } from "../core/schematic";
import { PinType } from "../core/types";

export enum ERCSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

export interface ERCViolation {
  code: string;
  severity: ERCSeverity;
  message: string;
  location?: {
    sheet?: string;
    element?: string;
    position?: { x: number; y: number };
  };
}

export interface ERCResult {
  violations: ERCViolation[];
  errorCount: number;
  warningCount: number;
  passed: boolean;
}

export interface ERCConfig {
  checkPinConflicts: boolean;
  checkUnconnectedPins: boolean;
  checkDuplicateReferences: boolean;
  checkOffGridPins: boolean;
  treatWarningsAsErrors: boolean;
}

export const DEFAULT_ERC_CONFIG: ERCConfig = {
  checkPinConflicts: true,
  checkUnconnectedPins: true,
  checkDuplicateReferences: true,
  checkOffGridPins: true,
  treatWarningsAsErrors: false,
};

export class ElectricalRulesChecker {
  private schematic: Schematic;
  private config: ERCConfig;

  constructor(schematic: Schematic, config?: Partial<ERCConfig>) {
    this.schematic = schematic;
    this.config = { ...DEFAULT_ERC_CONFIG, ...config };
  }

  check(): ERCResult {
    const violations: ERCViolation[] = [];

    if (this.config.checkDuplicateReferences) {
      violations.push(...this.checkDuplicateReferences());
    }

    if (this.config.checkOffGridPins) {
      violations.push(...this.checkOffGridPins());
    }

    const errorCount = violations.filter(
      (v) => v.severity === ERCSeverity.ERROR
    ).length;
    const warningCount = violations.filter(
      (v) => v.severity === ERCSeverity.WARNING
    ).length;

    return {
      violations,
      errorCount,
      warningCount,
      passed: this.config.treatWarningsAsErrors
        ? errorCount + warningCount === 0
        : errorCount === 0,
    };
  }

  private checkDuplicateReferences(): ERCViolation[] {
    const violations: ERCViolation[] = [];
    const seen = new Map<string, string>();

    for (const component of this.schematic.components) {
      const ref = component.reference;
      if (seen.has(ref)) {
        violations.push({
          code: "DUPLICATE_REFERENCE",
          severity: ERCSeverity.ERROR,
          message: `Duplicate reference designator: ${ref}`,
          location: { element: component.uuid },
        });
      } else {
        seen.set(ref, component.uuid);
      }
    }

    return violations;
  }

  private checkOffGridPins(): ERCViolation[] {
    const violations: ERCViolation[] = [];
    const gridSize = 1.27;

    for (const component of this.schematic.components) {
      const pos = component.position;
      const snapX = Math.round(pos.x / gridSize) * gridSize;
      const snapY = Math.round(pos.y / gridSize) * gridSize;

      if (Math.abs(pos.x - snapX) > 0.01 || Math.abs(pos.y - snapY) > 0.01) {
        violations.push({
          code: "OFF_GRID",
          severity: ERCSeverity.WARNING,
          message: `Component ${component.reference} is off-grid`,
          location: { element: component.uuid, position: pos },
        });
      }
    }

    return violations;
  }
}
```

---

## BOM Auditor (`src/bom/auditor.ts`)

```typescript
// src/bom/auditor.ts

import { Schematic } from "../core/schematic";
import { Component } from "../core/collections/component";
import { writeFileSync, readdirSync } from "fs";
import { join } from "path";

export interface ComponentIssue {
  schematic: string;
  reference: string;
  value: string;
  footprint: string;
  libId: string;
  missingProperties: string[];
  existingProperties: Record<string, string>;
}

export class BOMPropertyAuditor {
  auditSchematic(
    schematicPath: string,
    requiredProperties: string[],
    excludeDnp: boolean = false
  ): ComponentIssue[] {
    const issues: ComponentIssue[] = [];

    try {
      const sch = Schematic.load(schematicPath);

      for (const component of sch.components) {
        if (excludeDnp && !component.inBom) {
          continue;
        }

        const missing: string[] = [];
        for (const prop of requiredProperties) {
          if (!component.getProperty(prop)) {
            missing.push(prop);
          }
        }

        if (missing.length > 0) {
          issues.push({
            schematic: schematicPath,
            reference: component.reference,
            value: component.value,
            footprint: component.footprint || "",
            libId: component.libId,
            missingProperties: missing,
            existingProperties: component.properties,
          });
        }
      }
    } catch (e) {
      console.error(`Error loading ${schematicPath}:`, e);
    }

    return issues;
  }

  auditDirectory(
    directory: string,
    requiredProperties: string[],
    recursive: boolean = true,
    excludeDnp: boolean = false
  ): ComponentIssue[] {
    const issues: ComponentIssue[] = [];
    const files = this.findSchematicFiles(directory, recursive);

    for (const file of files) {
      issues.push(...this.auditSchematic(file, requiredProperties, excludeDnp));
    }

    return issues;
  }

  private findSchematicFiles(directory: string, recursive: boolean): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isFile() && entry.name.endsWith(".kicad_sch")) {
          files.push(fullPath);
        } else if (recursive && entry.isDirectory()) {
          files.push(...this.findSchematicFiles(fullPath, recursive));
        }
      }
    } catch (e) {
      // Directory not readable
    }

    return files;
  }

  generateCsvReport(issues: ComponentIssue[], outputPath: string): void {
    const headers = [
      "Schematic",
      "Reference",
      "Value",
      "Footprint",
      "LibID",
      "Missing Properties",
    ];
    const rows = issues.map((issue) => [
      issue.schematic,
      issue.reference,
      issue.value,
      issue.footprint,
      issue.libId,
      issue.missingProperties.join("; "),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    writeFileSync(outputPath, csv);
  }
}
```

---

## Python Code Generator (`src/exporters/python-generator.ts`)

```typescript
// src/exporters/python-generator.ts

import { Schematic } from "../core/schematic";
import { Component } from "../core/collections/component";
import { Wire, Label, GlobalLabel, HierarchicalLabel } from "../core/types";

export class PythonCodeGenerator {
  private template: "minimal" | "default" | "verbose" | "documented";
  private formatCode: boolean;
  private addComments: boolean;

  constructor(
    template: "minimal" | "default" | "verbose" | "documented" = "default",
    formatCode: boolean = true,
    addComments: boolean = true
  ) {
    this.template = template;
    this.formatCode = formatCode;
    this.addComments = addComments;
  }

  generate(
    schematic: Schematic,
    includeHierarchy: boolean = true,
    outputPath?: string
  ): string {
    const lines: string[] = [];

    lines.push("#!/usr/bin/env python3");
    lines.push('"""');
    lines.push(
      `Generated from: ${schematic.fileIO?.getFilePath() || "unknown"}`
    );
    lines.push(`Generated at: ${new Date().toISOString()}`);
    lines.push('"""');
    lines.push("");
    lines.push("import kicad_sch_api as ksa");
    lines.push("");

    const title = schematic.title || "Untitled";
    lines.push(`# Create schematic`);
    lines.push(`sch = ksa.create_schematic("${this.escapeString(title)}")`);
    lines.push("");

    if (schematic.components.length > 0) {
      lines.push("# Add components");
      for (const component of schematic.components) {
        lines.push(this.generateComponentCode(component));
      }
      lines.push("");
    }

    if (schematic.wires.length > 0) {
      lines.push("# Add wires");
      for (const wire of schematic.wires) {
        lines.push(this.generateWireCode(wire));
      }
      lines.push("");
    }

    if (schematic.labels.length > 0) {
      lines.push("# Add labels");
      for (const label of schematic.labels) {
        lines.push(this.generateLabelCode(label));
      }
      lines.push("");
    }

    if (outputPath) {
      lines.push(`# Save schematic`);
      lines.push(`sch.save("${this.escapeString(outputPath)}")`);
    }

    return lines.join("\n");
  }

  private generateComponentCode(component: Component): string {
    const pos = component.position;
    let code = `sch.components.add(`;
    code += `lib_id="${component.libId}", `;
    code += `reference="${component.reference}", `;
    code += `value="${this.escapeString(component.value)}", `;
    code += `position=(${pos.x}, ${pos.y})`;

    if (component.rotation !== 0) {
      code += `, rotation=${component.rotation}`;
    }
    if (component.footprint) {
      code += `, footprint="${component.footprint}"`;
    }

    code += ")";
    return code;
  }

  private generateWireCode(wire: Wire): string {
    if (wire.points.length === 2) {
      const start = wire.points[0];
      const end = wire.points[1];
      return `sch.wires.add(start=(${start.x}, ${start.y}), end=(${end.x}, ${end.y}))`;
    } else {
      const points = wire.points.map((p) => `(${p.x}, ${p.y})`).join(", ");
      return `sch.wires.add(points=[${points}])`;
    }
  }

  private generateLabelCode(
    label: Label | GlobalLabel | HierarchicalLabel
  ): string {
    const pos = label.position;
    return `sch.labels.add(text="${this.escapeString(label.text)}", position=(${
      pos.x
    }, ${pos.y}))`;
  }

  private escapeString(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  }
}
```

---

## Phased Success Criteria (Part 2)

### Phase 1: Symbol Library Cache

- [ ] Implement `SymbolLibraryCache` class
- [ ] Implement automatic discovery of KiCAD library paths
- [ ] Implement parsing for `.kicad_sym` files
- [ ] Implement `getSymbol`, `searchSymbols`, `getLibrarySymbols`
- [ ] Pass tests for finding common symbols (e.g., `Device:R`)

### Phase 2: Geometry Module

- [ ] Implement `snapToGrid` function
- [ ] Implement `createOrthogonalRouting` function
- [ ] Implement `BoundingBox` utilities
- [ ] Implement `SymbolBoundingBoxCalculator`
- [ ] Implement `getComponentBoundingBox`
- [ ] Pass geometry tests

### Phase 3: Connectivity & Hierarchy

- [ ] Implement connectivity analysis in `src/connectivity/analyzer.ts`
- [ ] Implement `checkPinConnection` function
- [ ] Implement `HierarchyManager` class
- [ ] Implement `buildHierarchyTree` and `validateSheetPins`
- [ ] Pass connectivity and hierarchy tests

### Phase 4: Validation/ERC Module

- [ ] Implement `ERCViolation`, `ERCResult`, `ERCConfig` types
- [ ] Implement `ElectricalRulesChecker` class
- [ ] Implement duplicate reference check
- [ ] Implement off-grid check
- [ ] Pass ERC tests

### Phase 5: BOM, Discovery & Exporters

- [ ] Implement `BOMPropertyAuditor` class
- [ ] Implement `ComponentSearchIndex` with SQLite (optional, can be deferred)
- [ ] Implement `PythonCodeGenerator` class
- [ ] Pass BOM and exporter tests

---

## Mandatory Test Cases (Part 2)

### Test 1: Symbol Library Cache

```typescript
// test/integration/library.test.ts
import { getSymbolCache } from "../../src/library/cache";

describe("Symbol Library Cache", () => {
  it("should find and parse the Device:R symbol", () => {
    const cache = getSymbolCache();
    const symbol = cache.getSymbol("Device:R");

    expect(symbol).toBeDefined();
    expect(symbol?.name).toBe("R");
    expect(symbol?.referencePrefix).toBe("R");
  });

  it("should search for resistors", () => {
    const cache = getSymbolCache();
    const results = cache.searchSymbols("resistor", 10);

    expect(results.length).toBeGreaterThan(0);
  });
});
```

### Test 2: Routing

```typescript
// test/integration/geometry.test.ts
import {
  createOrthogonalRouting,
  CornerDirection,
} from "../../src/geometry/routing";

describe("Routing", () => {
  it("should create direct route for aligned points", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 100 }
    );

    expect(result.isDirectRoute).toBe(true);
    expect(result.segments).toHaveLength(1);
  });

  it("should create L-shaped route for non-aligned points", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 150 }
    );

    expect(result.isDirectRoute).toBe(false);
    expect(result.segments).toHaveLength(2);
    expect(result.corner).toBeDefined();
  });
});
```

### Test 3: Bounding Box

```typescript
import {
  getComponentBoundingBox,
  getBoundingBoxWidth,
} from "../../src/geometry/symbol-bbox";
import { getSymbolCache } from "../../src/library/cache";
import { Schematic } from "../../src";

describe("Bounding Box", () => {
  it("should calculate component bounding box", () => {
    const sch = Schematic.load(
      "test/fixtures/single_resistor/single_resistor.kicad_sch"
    );
    const cache = getSymbolCache();

    const component = sch.components.get("R1");
    expect(component).toBeDefined();

    const bbox = getComponentBoundingBox(component!, cache);
    expect(bbox).toBeDefined();
    expect(getBoundingBoxWidth(bbox!)).toBeGreaterThan(0);
  });
});
```

### Test 4: ERC

```typescript
// test/integration/erc.test.ts
import { ElectricalRulesChecker, ERCSeverity } from "../../src/validation/erc";
import { Schematic } from "../../src";

describe("ERC", () => {
  it("should pass for a valid schematic", () => {
    const sch = Schematic.load(
      "test/fixtures/single_resistor/single_resistor.kicad_sch"
    );
    const checker = new ElectricalRulesChecker(sch);
    const result = checker.check();

    expect(result.errorCount).toBe(0);
  });
});
```

### Test 5: BOM Audit

```typescript
// test/integration/bom.test.ts
import { BOMPropertyAuditor } from "../../src/bom/auditor";

describe("BOM Audit", () => {
  it("should find missing properties", () => {
    const auditor = new BOMPropertyAuditor();
    const issues = auditor.auditSchematic(
      "test/fixtures/single_resistor/single_resistor.kicad_sch",
      ["PartNumber", "Manufacturer"]
    );

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].missingProperties).toContain("PartNumber");
  });
});
```

### Test 6: Python Export

```typescript
// test/integration/exporter.test.ts
import { PythonCodeGenerator } from "../../src/exporters/python-generator";
import { Schematic } from "../../src";

describe("Python Export", () => {
  it("should generate valid Python code", () => {
    const sch = Schematic.create("Test");
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });

    const generator = new PythonCodeGenerator();
    const code = generator.generate(sch);

    expect(code).toContain("import kicad_sch_api as ksa");
    expect(code).toContain("sch.components.add");
    expect(code).toContain("Device:R");
  });
});
```

---

## Agent Instructions

1. **Build on Part 1:** Ensure the Core Engine is complete and all its tests pass.
2. **Test Against Real Libraries:** If KiCAD is installed, the library cache tests should find real symbols.
3. **Signal Completion:** When all tests pass, output:
   ```
   ✅ PART 2 COMPLETE: Library & Analysis features implemented. All analysis tests passing.
   ```
