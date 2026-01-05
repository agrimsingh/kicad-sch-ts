---
task: "Port kicad-sch-api to TypeScript - Part 2.5: Final Implementation"
test_command: "npm test"
completion_criteria:
  - All new and updated modules are implemented as specified.
  - All new test files are created and contain the specified tests.
  - The existing test suite continues to pass.
  - The new tests for ERC, hierarchy, bounding box, and search also pass.
  - The library is feature-complete with the Python original for all analysis modules.
max_iterations: 250
---

# Task: Port `kicad-sch-api` to TypeScript - Part 2.5: Final Implementation

This document provides the **complete, final, and verified implementation details** for the modules that were previously incomplete or missing. This is your guide to making the `kicad-sch-ts` library feature-complete.

**Your goal is to replace placeholder/simplified code with this production-ready code and add the corresponding tests.**

---

## 1. Create `src/validation/pin-matrix.ts`

This file was missing. It is essential for the ERC `checkPinConflicts` feature.

**Instructions:** Create the file `src/validation/pin-matrix.ts` with the following content.

```typescript
// src/validation/pin-matrix.ts

import { PinType } from "../core/types";

export enum PinSeverity {
  OK = 0,
  WARNING = 1,
  ERROR = 2,
}

const PIN_TYPE_ALIASES: Record<string, PinType> = {
  input: PinType.INPUT,
  output: PinType.OUTPUT,
  bidirectional: PinType.BIDIRECTIONAL,
  tristate: PinType.TRI_STATE,
  passive: PinType.PASSIVE,
  free: PinType.FREE,
  unspecified: PinType.UNSPECIFIED,
  power_in: PinType.POWER_IN,
  power_out: PinType.POWER_OUT,
  open_collector: PinType.OPEN_COLLECTOR,
  open_emitter: PinType.OPEN_EMITTER,
  no_connect: PinType.NO_CONNECT,
};

export class PinConflictMatrix {
  private matrix: Map<string, PinSeverity> = new Map();

  constructor() {
    this.matrix = this.getDefaultMatrix();
  }

  private getDefaultMatrix(): Map<string, PinSeverity> {
    const matrix = new Map<string, PinSeverity>();
    const pinTypes = Object.values(PinType);

    for (const pin1 of pinTypes) {
      for (const pin2 of pinTypes) {
        matrix.set(`${pin1},${pin2}`, PinSeverity.OK);
      }
    }

    const errorRules: [PinType, PinType][] = [
      [PinType.OUTPUT, PinType.OUTPUT],
      [PinType.POWER_OUT, PinType.POWER_OUT],
      [PinType.OUTPUT, PinType.POWER_OUT],
      [PinType.NO_CONNECT, PinType.INPUT],
      [PinType.NO_CONNECT, PinType.OUTPUT],
      [PinType.NO_CONNECT, PinType.BIDIRECTIONAL],
      [PinType.NO_CONNECT, PinType.TRI_STATE],
      [PinType.NO_CONNECT, PinType.POWER_IN],
      [PinType.NO_CONNECT, PinType.POWER_OUT],
      [PinType.NO_CONNECT, PinType.OPEN_COLLECTOR],
      [PinType.NO_CONNECT, PinType.OPEN_EMITTER],
    ];

    for (const [pin1, pin2] of errorRules) {
      matrix.set(`${pin1},${pin2}`, PinSeverity.ERROR);
      matrix.set(`${pin2},${pin1}`, PinSeverity.ERROR);
    }

    const warningRules: [PinType, PinType][] = [
      [PinType.UNSPECIFIED, PinType.INPUT],
      [PinType.UNSPECIFIED, PinType.OUTPUT],
      [PinType.UNSPECIFIED, PinType.BIDIRECTIONAL],
      [PinType.UNSPECIFIED, PinType.TRI_STATE],
      [PinType.UNSPECIFIED, PinType.PASSIVE],
      [PinType.UNSPECIFIED, PinType.POWER_IN],
      [PinType.UNSPECIFIED, PinType.POWER_OUT],
      [PinType.UNSPECIFIED, PinType.OPEN_COLLECTOR],
      [PinType.UNSPECIFIED, PinType.OPEN_EMITTER],
      [PinType.UNSPECIFIED, PinType.UNSPECIFIED],
      [PinType.TRI_STATE, PinType.OUTPUT],
      [PinType.TRI_STATE, PinType.TRI_STATE],
    ];

    for (const [pin1, pin2] of warningRules) {
      matrix.set(`${pin1},${pin2}`, PinSeverity.WARNING);
      matrix.set(`${pin2},${pin1}`, PinSeverity.WARNING);
    }

    for (const pinType of pinTypes) {
      if (pinType !== PinType.NO_CONNECT) {
        matrix.set(`${PinType.PASSIVE},${pinType}`, PinSeverity.OK);
        matrix.set(`${pinType},${PinType.PASSIVE}`, PinSeverity.OK);
      }
    }

    for (const pinType of pinTypes) {
      matrix.set(`${PinType.FREE},${pinType}`, PinSeverity.OK);
      matrix.set(`${pinType},${PinType.FREE}`, PinSeverity.OK);
    }

    return matrix;
  }

  normalizePinType(pinType: string): PinType {
    const normalized = pinType.toLowerCase().trim();
    if (normalized in PIN_TYPE_ALIASES) {
      return PIN_TYPE_ALIASES[normalized];
    }
    // Fallback for aliases not in the map
    for (const key in PIN_TYPE_ALIASES) {
      if (key.includes(normalized)) return PIN_TYPE_ALIASES[key];
    }
    throw new Error(`Unknown pin type: ${pinType}`);
  }

  checkConnection(pin1_type: string, pin2_type: string): PinSeverity {
    const pin1 = this.normalizePinType(pin1_type);
    const pin2 = this.normalizePinType(pin2_type);
    const key = `${pin1},${pin2}`;
    return this.matrix.get(key) ?? PinSeverity.ERROR;
  }
}
```

---

## 2. Update `src/validation/erc.ts`

**Instructions:** Update the `ElectricalRulesChecker` to use the new `PinConflictMatrix` and the existing `ConnectivityAnalyzer`.

```typescript
// src/validation/erc.ts

import { Schematic } from "../core/schematic";
import { PinType } from "../core/types";
import { ConnectivityAnalyzer, NetInfo } from "../connectivity/analyzer";
import { PinConflictMatrix, PinSeverity } from "./pin-matrix";

// ... (keep existing interfaces: ERCSeverity, ERCViolation, ERCResult, ERCConfig, DEFAULT_ERC_CONFIG)

export class ElectricalRulesChecker {
  private schematic: Schematic;
  private config: ERCConfig;
  private connectivityAnalyzer: ConnectivityAnalyzer;
  private pinConflictMatrix: PinConflictMatrix;

  constructor(schematic: Schematic, config?: Partial<ERCConfig>) {
    this.schematic = schematic;
    this.config = { ...DEFAULT_ERC_CONFIG, ...config };
    this.connectivityAnalyzer = new ConnectivityAnalyzer(
      schematic,
      schematic.getSymbolCache()
    );
    this.pinConflictMatrix = new PinConflictMatrix();
  }

  check(): ERCResult {
    const violations: ERCViolation[] = [];
    const nets = this.connectivityAnalyzer.analyzeNets();

    if (this.config.checkPinConflicts) {
      violations.push(...this.checkPinConflicts(nets));
    }
    if (this.config.checkUnconnectedPins) {
      violations.push(...this.checkUnconnectedPins(nets));
    }
    if (this.config.checkDuplicateReferences) {
      violations.push(...this.checkDuplicateReferences());
    }
    if (this.config.checkOffGridPins) {
      violations.push(...this.checkOffGridPins());
    }
    if (this.config.checkMissingFootprints) {
      violations.push(...this.checkMissingFootprints());
    }
    if (this.config.checkMissingValues) {
      violations.push(...this.checkMissingValues());
    }

    violations.push(...this.checkFloatingLabels(nets));

    const errorCount = violations.filter(
      (v) => v.severity === ERCSeverity.ERROR
    ).length;
    const warningCount = violations.filter(
      (v) => v.severity === ERCSeverity.WARNING
    ).length;
    const infoCount = violations.filter(
      (v) => v.severity === ERCSeverity.INFO
    ).length;

    return {
      violations,
      errorCount,
      warningCount,
      infoCount,
      passed: this.config.treatWarningsAsErrors
        ? errorCount + warningCount === 0
        : errorCount === 0,
    };
  }

  private checkPinConflicts(nets: NetInfo[]): ERCViolation[] {
    const violations: ERCViolation[] = [];
    for (const net of nets) {
      if (net.pins.length < 2) continue;

      const pinTypes = net.pins.map((p) => {
        const component = this.schematic.components.get(p.reference);
        if (!component) return PinType.UNSPECIFIED;
        const symbol = this.schematic
          .getSymbolCache()
          ?.getSymbol(component.libId);
        if (!symbol) return PinType.UNSPECIFIED;
        const unit = symbol.units.get(component.unit) || symbol.units.get(0);
        const pinDef = unit?.pins.find((pin) => pin.number === p.pin);
        return pinDef?.electricalType || PinType.UNSPECIFIED;
      });

      for (let i = 0; i < pinTypes.length; i++) {
        for (let j = i + 1; j < pinTypes.length; j++) {
          const severity = this.pinConflictMatrix.checkConnection(
            pinTypes[i],
            pinTypes[j]
          );
          if (severity === PinSeverity.ERROR) {
            violations.push({
              code: "PIN_CONFLICT_ERROR",
              severity: ERCSeverity.ERROR,
              message: `Pin conflict on net ${net.name}: ${pinTypes[i]} connected to ${pinTypes[j]}`,
            });
          } else if (severity === PinSeverity.WARNING) {
            violations.push({
              code: "PIN_CONFLICT_WARNING",
              severity: ERCSeverity.WARNING,
              message: `Pin conflict on net ${net.name}: ${pinTypes[i]} connected to ${pinTypes[j]}`,
            });
          }
        }
      }
    }
    return violations;
  }

  private checkUnconnectedPins(nets: NetInfo[]): ERCViolation[] {
    const violations: ERCViolation[] = [];
    const connectedPins = new Set<string>();
    for (const net of nets) {
      for (const pin of net.pins) {
        connectedPins.add(`${pin.reference}-${pin.pin}`);
      }
    }

    for (const component of this.schematic.components) {
      const symbol = this.schematic
        .getSymbolCache()
        ?.getSymbol(component.libId);
      if (!symbol) continue;
      const unit = symbol.units.get(component.unit) || symbol.units.get(0);
      if (!unit) continue;

      for (const pinDef of unit.pins) {
        if (pinDef.electricalType === PinType.NO_CONNECT) continue;
        const pinId = `${component.reference}-${pinDef.number}`;
        if (!connectedPins.has(pinId)) {
          violations.push({
            code: "UNCONNECTED_PIN",
            severity: ERCSeverity.WARNING,
            message: `Pin ${pinDef.number} of ${component.reference} is unconnected`,
            location: { element: component.uuid },
          });
        }
      }
    }
    return violations;
  }

  private checkFloatingLabels(nets: NetInfo[]): ERCViolation[] {
    const violations: ERCViolation[] = [];
    const labelsOnNets = new Set<string>();
    for (const net of nets) {
      for (const label of net.labels) {
        labelsOnNets.add(label);
      }
    }

    for (const label of this.schematic.labels) {
      if (!labelsOnNets.has(label.text)) {
        violations.push({
          code: "FLOATING_LABEL",
          severity: ERCSeverity.WARNING,
          message: `Label "${label.text}" may not be connected to a wire`,
          location: { element: label.uuid, position: label.position },
        });
      }
    }
    return violations;
  }

  // ... (keep checkDuplicateReferences, checkOffGridPins, checkMissingFootprints, checkMissingValues)
  // ... (keep getSummary, getViolationsBySeverity, hasViolation)
}
```

---

## 3. Create `test/validation/erc.test.ts`

**Instructions:** Create a new test file for the ERC module.

```typescript
// test/validation/erc.test.ts

import { Schematic } from "../../src/core/schematic";
import { ElectricalRulesChecker, ERCSeverity } from "../../src/validation/erc";
import {
  PinConflictMatrix,
  PinSeverity,
} from "../../src/validation/pin-matrix";

describe("PinConflictMatrix", () => {
  const matrix = new PinConflictMatrix();

  it("should flag an error for output-to-output connection", () => {
    const severity = matrix.checkConnection("output", "output");
    expect(severity).toBe(PinSeverity.ERROR);
  });

  it("should be OK for input-to-passive connection", () => {
    const severity = matrix.checkConnection("input", "passive");
    expect(severity).toBe(PinSeverity.OK);
  });

  it("should flag a warning for unspecified-to-input", () => {
    const severity = matrix.checkConnection("unspecified", "input");
    expect(severity).toBe(PinSeverity.WARNING);
  });
});

describe("ElectricalRulesChecker", () => {
  it("should detect pin conflicts in a schematic", () => {
    const sch = new Schematic();
    // You would need to construct a schematic with a pin conflict here
    // This is complex, so we will rely on integration tests with real files for now.
  });
});
```

---

## 4. Create `src/geometry/font-metrics.ts`

**Instructions:** Create this new file.

```typescript
// src/geometry/font-metrics.ts

export const DEFAULT_TEXT_HEIGHT = 2.54; // 100 mils
export const DEFAULT_PIN_LENGTH = 2.54; // 100 mils
export const DEFAULT_PIN_NAME_OFFSET = 0.508; // 20 mils
export const DEFAULT_PIN_NUMBER_SIZE = 1.27; // 50 mils
export const DEFAULT_PIN_TEXT_WIDTH_RATIO = 0.65;
```

---

## 5. Update `src/geometry/symbol-bbox.ts`

**Instructions:** Overwrite the existing simplified file with this complete implementation.

```typescript
// src/geometry/symbol-bbox.ts

import {
  Point,
  SymbolDefinition,
  SymbolGraphics,
  SymbolPin,
} from "../core/types";
import {
  DEFAULT_PIN_LENGTH,
  DEFAULT_PIN_NAME_OFFSET,
  DEFAULT_PIN_NUMBER_SIZE,
  DEFAULT_PIN_TEXT_WIDTH_RATIO,
  DEFAULT_TEXT_HEIGHT,
} from "./font-metrics";

export class SymbolBoundingBoxCalculator {
  static calculateBoundingBox(
    symbolData: SymbolDefinition,
    includeProperties: boolean = true,
    pinNetMap?: Record<string, string>
  ): [number, number, number, number] {
    if (!symbolData) {
      throw new Error("Symbol data is None or empty");
    }

    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];

    const updateBounds = (bounds: [number, number, number, number] | null) => {
      if (!bounds) return;
      minX = Math.min(minX, bounds[0]);
      minY = Math.min(minY, bounds[1]);
      maxX = Math.max(maxX, bounds[2]);
      maxY = Math.max(maxY, bounds[3]);
    };

    for (const unit of symbolData.units.values()) {
      for (const shape of unit.graphics) {
        updateBounds(this._getShapeBounds(shape));
      }
      for (const pin of unit.pins) {
        updateBounds(this._getPinBounds(pin, pinNetMap));
      }
    }

    if (minX === Infinity) {
      // If no geometry, create a default small box
      return [-1, -1, 1, 1];
    }

    const margin = 0.254; // 10 mils
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    if (includeProperties) {
      const componentWidth = maxX - minX;
      const componentHeight = maxY - minY;
      const propertyWidth = Math.max(10.0, componentWidth * 0.8);
      const propertyHeight = DEFAULT_TEXT_HEIGHT;
      const verticalSpacingAbove = Math.max(5.0, componentHeight * 0.1);
      const verticalSpacingBelow = Math.max(10.0, componentHeight * 0.15);

      minY -= verticalSpacingAbove + propertyHeight;
      maxY += verticalSpacingBelow + propertyHeight;

      const centerX = (minX + maxX) / 2;
      minX = Math.min(minX, centerX - propertyWidth / 2);
      maxX = Math.max(maxX, centerX + propertyWidth / 2);
    }

    return [minX, minY, maxX, maxY];
  }

  private static _getShapeBounds(
    shape: SymbolGraphics
  ): [number, number, number, number] | null {
    const shapeType = shape.type;
    switch (shapeType) {
      case "rectangle": {
        const start = shape.start as Point;
        const end = shape.end as Point;
        return [
          Math.min(start.x, end.x),
          Math.min(start.y, end.y),
          Math.max(start.x, end.x),
          Math.max(start.y, end.y),
        ];
      }
      case "circle": {
        const center = shape.center as Point;
        const radius = shape.radius as number;
        return [
          center.x - radius,
          center.y - radius,
          center.x + radius,
          center.y + radius,
        ];
      }
      case "arc": {
        const start = shape.start as Point;
        const mid = shape.mid as Point;
        const end = shape.end as Point;
        const minX = Math.min(start.x, mid.x, end.x);
        const minY = Math.min(start.y, mid.y, end.y);
        const maxX = Math.max(start.x, mid.x, end.x);
        const maxY = Math.max(start.y, mid.y, end.y);
        return [minX, minY, maxX, maxY];
      }
      case "polyline": {
        const points = shape.pts as Point[];
        if (!points || points.length === 0) return null;
        const minX = Math.min(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxX = Math.max(...points.map((p) => p.x));
        const maxY = Math.max(...points.map((p) => p.y));
        return [minX, minY, maxX, maxY];
      }
      case "text": {
        const at = shape.at as Point;
        const text = shape.text as string;
        const textWidth = text.length * DEFAULT_TEXT_HEIGHT * 0.6;
        const textHeight = DEFAULT_TEXT_HEIGHT;
        return [
          at.x - textWidth / 2,
          at.y - textHeight / 2,
          at.x + textWidth / 2,
          at.y + textHeight / 2,
        ];
      }
    }
    return null;
  }

  private static _getPinBounds(
    pin: SymbolPin,
    pinNetMap?: Record<string, string>
  ): [number, number, number, number] | null {
    const { x, y } = pin.position;
    const angle = pin.rotation;
    const length = pin.length || DEFAULT_PIN_LENGTH;

    const angleRad = (angle * Math.PI) / 180;
    const endX = x + length * Math.cos(angleRad);
    const endY = y + length * Math.sin(angleRad);

    let [minX, minY, maxX, maxY] = [
      Math.min(x, endX),
      Math.min(y, endY),
      Math.max(x, endX),
      Math.max(y, endY),
    ];

    const pinName = pin.name || "";
    const pinNumber = pin.number || "";

    const labelText =
      (pinNetMap && pinNetMap[pinNumber]) || (pinName !== "~" ? pinName : "");

    if (labelText) {
      const nameWidth =
        labelText.length * DEFAULT_TEXT_HEIGHT * DEFAULT_PIN_TEXT_WIDTH_RATIO;
      const nameHeight = DEFAULT_TEXT_HEIGHT;
      const offset = DEFAULT_PIN_NAME_OFFSET;

      if (angle === 0) {
        // Right
        minX = Math.min(minX, endX - offset - nameWidth);
      } else if (angle === 180) {
        // Left
        maxX = Math.max(maxX, endX + offset + nameWidth);
      } else if (angle === 90) {
        // Up
        minY = Math.min(minY, endY - offset - nameHeight);
      } else if (angle === 270) {
        // Down
        maxY = Math.max(maxY, endY + offset + nameHeight);
      }
    }

    if (pinNumber) {
      const margin = DEFAULT_PIN_NUMBER_SIZE * 1.5;
      minX -= margin;
      minY -= margin;
      maxX += margin;
      maxY += margin;
    }

    return [minX, minY, maxX, maxY];
  }
}
```

---

## 6. Update `src/core/managers/hierarchy.ts`

**Instructions:** Overwrite the existing simplified file with this complete implementation. You will need to add the new interfaces to `src/core/types.ts` as well.

**Add to `src/core/types.ts`:**

```typescript
// Add these interfaces to your types.ts file

export interface HierarchyNode {
  path: string;
  name: string;
  filename: string;
  schematic?: Schematic;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  sheetPins: SheetPin[];
  level: number;
}

export interface SheetPinConnection {
  sheetPath: string;
  pinName: string;
  labelName: string;
  isMatch: boolean;
}

export interface SignalPath {
  signalName: string;
  startPath: string;
  endPath: string;
  connections: string[];
  sheetCrossings: number;
}
```

**Overwrite `src/core/managers/hierarchy.ts`:**

```typescript
// src/core/managers/hierarchy.ts

import { existsSync } from "fs";
import { dirname, resolve, basename } from "path";
import { Schematic } from "../schematic";
import {
  Sheet,
  SheetPin,
  HierarchicalLabel,
  HierarchyNode,
  Point,
} from "../types";
import { HierarchyError } from "../exceptions";
import { BaseManager } from "./base";

export class HierarchyManager extends BaseManager {
  private _hierarchyTree: HierarchyNode | null = null;
  private _loadedSchematics: Map<string, Schematic> = new Map();

  constructor(schematic: Schematic) {
    super(schematic.data);
    this._loadedSchematics.set("/", schematic);
  }

  buildHierarchyTree(loadSubsheets: boolean = true): HierarchyNode {
    const rootSchematic = this._loadedSchematics.get("/")!;
    const rootPath = rootSchematic.fileIO?.getFilePath() || "";
    const rootNode: HierarchyNode = {
      path: "/",
      name: rootSchematic.title || basename(rootPath, ".kicad_sch"),
      filename: rootPath,
      schematic: rootSchematic,
      children: [],
      sheetPins: [],
      level: 0,
    };
    this._hierarchyTree = rootNode;
    if (loadSubsheets) {
      this._buildTreeRecursive(rootNode);
    }
    return rootNode;
  }

  private _buildTreeRecursive(node: HierarchyNode): void {
    const schematic = node.schematic;
    if (!schematic) return;

    const baseDir = dirname(node.filename);

    for (const sheet of schematic.sheets) {
      const childFilename = sheet.filename.value;
      const childPath = resolve(baseDir, childFilename);

      const childNode: HierarchyNode = {
        path: `${node.path}${sheet.uuid}/`,
        name: sheet.name.value,
        filename: childPath,
        children: [],
        parent: node,
        sheetPins: [...sheet.pins],
        level: node.level + 1,
      };

      if (existsSync(childPath)) {
        try {
          const childSchematic =
            this._loadedSchematics.get(childPath) || Schematic.load(childPath);
          this._loadedSchematics.set(childPath, childSchematic);
          childNode.schematic = childSchematic;
          this._buildTreeRecursive(childNode);
        } catch (e) {
          console.error(`Failed to load subsheet ${childPath}:`, e);
        }
      }
      node.children.push(childNode);
    }
  }

  flattenHierarchy(prefixReferences: boolean = true): any {
    if (!this._hierarchyTree) this.buildHierarchyTree(true);

    const flattened = {
      components: new Map<string, any>(),
      wires: [],
      labels: [],
      junctions: [],
    };

    this._flattenRecursive(
      this._hierarchyTree!,
      flattened,
      prefixReferences,
      ""
    );
    return flattened;
  }

  private _flattenRecursive(
    node: HierarchyNode,
    flattened: any,
    prefixReferences: boolean,
    prefix: string
  ): void {
    if (!node.schematic) return;

    const transformPoint = (p: Point, sheet: Sheet): Point => {
      return { x: p.x + sheet.position.x, y: p.y + sheet.position.y };
    };

    for (const component of node.schematic.components) {
      const newRef =
        prefixReferences && !node.parent
          ? component.reference
          : `${prefix}${component.reference}`;
      if (flattened.components.has(newRef)) continue;

      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(component.position, sheetInstance)
        : component.position;

      const newComp = {
        ...component.data,
        uuid: component.uuid,
        position: pos,
        reference: newRef,
      };
      flattened.components.set(newRef, newComp);
    }

    // ... (Transform and add wires, labels, junctions similarly)

    for (const child of node.children) {
      const sheet = node.schematic.sheets.find(
        (s) => s.name.value === child.name
      );
      if (sheet) {
        const childPrefix = prefixReferences
          ? `${prefix}${sheet.name.value}/`
          : prefix;
        this._flattenRecursive(child, flattened, prefixReferences, childPrefix);
      }
    }
  }

  // ... (Implement validateSheetPins, traceSignalPath, etc. based on Python source)
}
```

---

## 7. Update `src/discovery/search-index.ts`

**Instructions:** Overwrite the existing in-memory implementation with this full SQLite version.

**Run `npm install better-sqlite3` and `npm install --save-dev @types/better-sqlite3` first.**

```typescript
// src/discovery/search-index.ts

import Database from "better-sqlite3";
import { SymbolLibraryCache, SymbolDefinition } from "../library/cache";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export class ComponentSearchIndex {
  private db: Database.Database;
  private dbPath: string;

  constructor(cacheDir?: string) {
    const dir = cacheDir || path.join(os.homedir(), ".cache", "kicad-sch-ts");
    fs.mkdirSync(dir, { recursive: true });
    this.dbPath = path.join(dir, "search_index.db");
    this.db = new Database(this.dbPath);
    this._initDatabase();
  }

  private _initDatabase(): void {
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS components (
                lib_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                library TEXT NOT NULL,
                description TEXT DEFAULT 	,
                keywords TEXT DEFAULT 	,
                reference_prefix TEXT DEFAULT 'U',
                pin_count INTEGER DEFAULT 0,
                category TEXT DEFAULT 	,
                last_updated REAL DEFAULT 0
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(lib_id, name, description, keywords, content='components', content_rowid='rowid');
            CREATE TRIGGER IF NOT EXISTS components_after_insert AFTER INSERT ON components BEGIN
                INSERT INTO components_fts(rowid, lib_id, name, description, keywords) VALUES (new.rowid, new.lib_id, new.name, new.description, new.keywords);
            END;
        `);
  }

  rebuildIndex(
    symbolCache: SymbolLibraryCache,
    progressCallback?: (message: string) => void
  ): number {
    const symbols = symbolCache.getAllSymbols();
    this.db.exec("DELETE FROM components; DELETE FROM components_fts;");

    const insert = this.db.prepare(
      `INSERT INTO components (lib_id, name, library, description, keywords, reference_prefix, pin_count, category, last_updated)
             VALUES (@lib_id, @name, @library, @description, @keywords, @reference_prefix, @pin_count, @category, @last_updated)`
    );

    const transaction = this.db.transaction((batch: SymbolDefinition[]) => {
      for (const symbol of batch) {
        const data = {
          lib_id: symbol.libId,
          name: symbol.name,
          library: symbol.library,
          description: symbol.description,
          keywords: symbol.keywords,
          reference_prefix: symbol.referencePrefix,
          pin_count: symbol.pins.length,
          category: this._categorizeComponent(symbol),
          last_updated: Date.now(),
        };
        insert.run(data);
      }
    });

    transaction(symbols);
    return symbols.length;
  }

  search(
    query: string,
    library?: string,
    category?: string,
    limit: number = 20
  ): any[] {
    const ftsQuery = query
      .split(" ")
      .map((term) => `"${term}"*`)
      .join(" ");
    let sql = `
            SELECT c.*, fts.rank as match_score
            FROM components_fts fts
            JOIN components c ON c.lib_id = fts.lib_id
            WHERE fts MATCH ?
        `;
    const params: any[] = [ftsQuery];

    if (library) {
      sql += " AND c.library = ?";
      params.push(library);
    }
    if (category) {
      sql += " AND c.category = ?";
      params.push(category);
    }

    sql += " ORDER BY fts.rank LIMIT ?";
    params.push(limit);

    return this.db.prepare(sql).all(params);
  }

  private _categorizeComponent(symbol: SymbolDefinition): string {
    const prefix = symbol.referencePrefix.toUpperCase();
    if (prefix === "R") return "resistor";
    if (prefix === "C") return "capacitor";
    if (prefix === "L") return "inductor";
    if (prefix === "D" || prefix === "LED") return "diode";
    if (prefix === "Q") return "transistor";
    if (prefix === "U") return "integrated_circuit";
    if (prefix === "J") return "connector";
    return "other";
  }
}
```

---

## Agent Instructions

1.  **Install Dependencies:** Run `npm install better-sqlite3` and `npm install --save-dev @types/better-sqlite3`.
2.  **Create/Update Files:** Create or overwrite the files listed above with the provided code.
3.  **Add Interfaces:** Add the new `HierarchyNode`, `SheetPinConnection`, and `SignalPath` interfaces to `src/core/types.ts`.
4.  **Flesh out `HierarchyManager`:** The `hierarchy.ts` guide is a detailed skeleton. You must translate the remaining logic from the Python source file (`kicad-sch-api/kicad_sch_api/core/managers/hierarchy.py`) to complete the implementation, especially for `flattenHierarchy` and `traceSignalPath`.
5.  **Add New Tests:** Create the new test file `test/validation/erc.test.ts` and add the provided tests.
6.  **Run `npm test`** and ensure all tests, including the new ones, pass.
7.  When complete, output `✅ PART 2.5 COMPLETE`.
