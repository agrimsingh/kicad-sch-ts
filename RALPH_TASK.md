---
task: Port `kicad-sch-api` to TypeScript as `kicad-sch-ts`
test_command: "npm test"
completion_criteria:
  - Core S-expression parser and formatter working with exact format preservation
  - All data models ported from Python to TypeScript
  - Full implementation of `Schematic` class with all manager classes
  - All collection classes (components, wires, labels, junctions, etc.)
  - Connectivity analysis and hierarchy management working
  - Symbol library cache and discovery system implemented
  - BOM auditing and property management working
  - Geometry module (bounding boxes, routing) implemented
  - Validation/ERC system implemented
  - Python code exporter working
  - CLI adapter with all commands working
  - MCP server with all tools working
  - All mandatory test assertions pass (70+ tests)
max_iterations: 300
---

# Task: Port `kicad-sch-api` to TypeScript

This project is a **faithful, complete port** of the Python library `kicad-sch-api` (37,852 lines across 80+ files) to TypeScript. The resulting library, `kicad-sch-ts`, will provide a robust, type-safe API for programmatically reading, writing, and manipulating KiCAD 7/8 schematic files (`.kicad_sch`).

## The One-Line Success Criterion

For any KiCAD schematic, `kicad-sch-ts` must be able to read it into a set of intuitive TypeScript objects, allow for complex manipulations (adding components, routing wires, analyzing connectivity), and write it back to a `.kicad_sch` file that is **byte-for-byte identical** to what KiCAD's native Eeschema editor would produce.

---

## Source Reference

The Python source code is located at: `https://github.com/circuit-synth/kicad-sch-api`

Clone it locally and use it as the authoritative reference for all porting decisions:

```bash
git clone https://github.com/circuit-synth/kicad-sch-api.git
```

---

## Understanding the KiCAD Schematic Format

KiCAD schematic files (`.kicad_sch`) use an **S-expression** format. S-expressions are nested lists enclosed in parentheses, similar to Lisp. Here's a simplified example:

```lisp
(kicad_sch
  (version 20250114)
  (generator "eeschema")
  (generator_version "8.0")
  (uuid "a5ebdc97-f1ba-4650-8f00-5e19694cb317")
  (paper "A4")
  (title_block
    (title "My Circuit")
    (company "ACME Corp")
    (rev "1.0")
  )
  (lib_symbols
    (symbol "Device:R"
      (property "Reference" "R" (at 2.032 0 90) ...)
      (symbol "Device:R_0_1"
        (rectangle (start -1.016 -2.54) (end 1.016 2.54) ...)
      )
      (symbol "Device:R_1_1"
        (pin passive line (at 0 3.81 270) (length 1.27) ...)
        (pin passive line (at 0 -3.81 90) (length 1.27) ...)
      )
    )
  )
  (symbol
    (lib_id "Device:R")
    (at 93.98 81.28 0)
    (unit 1)
    (exclude_from_sim no)
    (in_bom yes)
    (on_board yes)
    (uuid "a9fd95f7-6e8c-4e46-ba2c-21946a035fdb")
    (property "Reference" "R1" (at 95.25 80.01 0) ...)
    (property "Value" "10k" (at 95.25 82.55 0) ...)
    (property "Footprint" "Resistor_SMD:R_0603_1608Metric" (at ...) ...)
    (pin "1" (uuid "..."))
    (pin "2" (uuid "..."))
    (instances
      (project "MyProject"
        (path "/a5ebdc97-f1ba-4650-8f00-5e19694cb317"
          (reference "R1") (unit 1)
        )
      )
    )
  )
  (wire (pts (xy 100 80) (xy 100 90)) (stroke ...) (uuid "..."))
  (label "VCC" (at 100 75 0) (effects ...) (uuid "..."))
  (junction (at 100 80) (diameter 0) (color 0 0 0 0) (uuid "..."))
)
```

**Key insight:** The Python library uses the `sexpdata` library to parse this format. The TypeScript port must achieve the same functionality with a custom or third-party S-expression parser.

---

## ⚠️ CRITICAL: KiCAD Coordinate System

**Understanding this is CRITICAL for working with this library. Get this wrong and nothing will work correctly.**

### The Two Coordinate Systems

KiCAD uses **two different Y-axis conventions**:

| Coordinate System   | Y-Axis Direction                     | Used In                                              |
| ------------------- | ------------------------------------ | ---------------------------------------------------- |
| **Symbol Space**    | Normal (+Y is UP, like math)         | Library symbol definitions (`.kicad_sym` files)      |
| **Schematic Space** | Inverted (+Y is DOWN, like graphics) | Placed components in schematics (`.kicad_sch` files) |

### The Y-Negation Transformation

When placing a symbol on a schematic, **Y coordinates are negated**:

```typescript
// Symbol library definition (normal Y, +Y up):
// Pin 1: (0, +3.81)   // 3.81mm UPWARD in symbol
// Pin 2: (0, -3.81)   // 3.81mm DOWNWARD in symbol

// Component placed at (100, 100) in schematic (inverted Y, +Y down):
// Y is NEGATED during transformation:
// Pin 1: (100, 100 + (-3.81)) = (100, 96.19)   // LOWER Y = visually HIGHER
// Pin 2: (100, 100 + (+3.81)) = (100, 103.81)  // HIGHER Y = visually LOWER
```

### Visual Interpretation

In schematic space (inverted Y-axis):

- **Lower Y values** = visually HIGHER on screen (toward top)
- **Higher Y values** = visually LOWER on screen (toward bottom)
- **X-axis is normal** (increases to the right)

### Grid Alignment (MANDATORY)

**ALL positions MUST be grid-aligned for proper connectivity:**

| Grid Size | Value               | Common Use                                  |
| --------- | ------------------- | ------------------------------------------- |
| Default   | **1.27mm (50 mil)** | Component positions, wire endpoints, labels |
| Fine      | 0.635mm (25 mil)    | Text positioning                            |
| Coarse    | 2.54mm (100 mil)    | Large component spacing                     |

**Valid grid-aligned values:** 0.00, 1.27, 2.54, 3.81, 5.08, 6.35, 7.62, 8.89, 10.16, ...

```typescript
// GOOD - on grid (1.27mm increments)
sch.components.add({
  libId: "Device:R",
  reference: "R1",
  value: "10k",
  position: { x: 100.33, y: 101.6 },
});

// BAD - off grid (will cause connectivity issues!)
sch.components.add({
  libId: "Device:R",
  reference: "R2",
  value: "10k",
  position: { x: 100.5, y: 101.3 },
});
```

### Where This Matters

The coordinate system transformation is critical for:

- **Pin position calculations** - Getting the actual position of a component's pins
- **Wire routing** - Connecting wires to the correct pin locations
- **Connectivity analysis** - Detecting which pins are connected
- **Component placement** - Positioning components relative to each other
- **Hierarchical connections** - Sheet pins and hierarchical labels
- **Bounding box calculations** - Collision detection for routing

---

## Architecture (Do Not Deviate)

The architecture MUST mirror the Python library's structure. It is split into these layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADAPTERS                                        │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │     CLI     │  │   MCP Server    │  │   Exporter  │  │  Discovery    │  │
│  │  (9 cmds)   │  │  (15+ tools)    │  │  (Python)   │  │  (SQLite)     │  │
│  └─────────────┘  └─────────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               ENGINE                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Connectivity   │  │    Hierarchy    │  │     Symbol Library          │  │
│  │    Analysis     │  │    Manager      │  │        Cache                │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Validation    │  │    Geometry     │  │         BOM                 │  │
│  │     (ERC)       │  │   (Routing)     │  │       Auditor               │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                CORE                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Schematic Class                              │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │  FileIO     │ │  Metadata   │ │    Wire     │ │   Sheet     │   │    │
│  │  │  Manager    │ │  Manager    │ │  Manager    │ │  Manager    │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │ FormatSync  │ │ Validation  │ │    Text     │ │  Graphics   │   │    │
│  │  │  Manager    │ │  Manager    │ │  Manager    │ │  Manager    │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          Collections                                 │    │
│  │  Components │ Wires │ Labels │ Junctions │ NoConnects │ BusEntries  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      S-Expression Layer                              │    │
│  │              Parser  │  Formatter  │  Types  │  Exceptions           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  - Input: `.kicad_sch` file content (string)                                │
│  - Output: Formatted `.kicad_sch` file content (string)                     │
│  - PURE: No side effects, no file I/O (just string in/out)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete File Structure

```
kicad-sch-ts/
├── src/
│   ├── index.ts                    # Main library exports + convenience functions
│   │
│   ├── core/
│   │   ├── index.ts                # Core exports
│   │   ├── types.ts                # All data model interfaces/enums (~900 lines in Python)
│   │   ├── parser.ts               # S-Expression parser (~700 lines)
│   │   ├── formatter.ts            # S-Expression formatter (~580 lines)
│   │   ├── schematic.ts            # Main Schematic class (~2100 lines)
│   │   ├── exceptions.ts           # Error classes (~180 lines)
│   │   ├── config.ts               # Configuration system (~235 lines)
│   │   ├── geometry.ts             # Core geometry functions (~200 lines)
│   │   ├── components.ts           # Component class (~980 lines)
│   │   ├── wires.ts                # Wire utilities (~200 lines)
│   │   ├── labels.ts               # Label utilities (~320 lines)
│   │   ├── texts.ts                # Text/TextBox utilities (~420 lines)
│   │   ├── nets.ts                 # Net utilities (~300 lines)
│   │   ├── junctions.ts            # Junction utilities (~160 lines)
│   │   ├── no-connects.ts          # NoConnect utilities (~250 lines)
│   │   ├── connectivity.ts         # Connectivity analysis (~700 lines)
│   │   ├── multi-unit.ts           # Multi-unit component support (~140 lines)
│   │   ├── pin-utils.ts            # Pin utilities (~240 lines)
│   │   ├── property-positioning.ts # Property placement (~260 lines)
│   │   ├── component-bounds.ts     # Bounding box calculations (~500 lines)
│   │   ├── ic-manager.ts           # IC-specific handling (~190 lines)
│   │   │
│   │   ├── collections/
│   │   │   ├── index.ts
│   │   │   ├── base.ts             # BaseCollection, IndexRegistry (~620 lines)
│   │   │   ├── components.ts       # ComponentCollection (~2000 lines)
│   │   │   ├── wires.ts            # WireCollection (~300 lines)
│   │   │   ├── labels.ts           # LabelCollection (~510 lines)
│   │   │   ├── junctions.ts        # JunctionCollection (~230 lines)
│   │   │   ├── no-connects.ts      # NoConnectCollection
│   │   │   └── bus-entries.ts      # BusEntryCollection (~190 lines)
│   │   │
│   │   ├── managers/
│   │   │   ├── index.ts
│   │   │   ├── base.ts             # Base manager class (~76 lines)
│   │   │   ├── file-io.ts          # File I/O operations (~246 lines)
│   │   │   ├── metadata.ts         # Title block, version (~271 lines)
│   │   │   ├── wire.ts             # Wire routing (~410 lines)
│   │   │   ├── sheet.ts            # Hierarchical sheets (~492 lines)
│   │   │   ├── hierarchy.ts        # Hierarchy management (~662 lines)
│   │   │   ├── format-sync.ts      # Format preservation (~502 lines)
│   │   │   ├── validation.ts       # Validation orchestration (~485 lines)
│   │   │   ├── text-elements.ts    # Text/TextBox management (~537 lines)
│   │   │   └── graphics.ts         # Graphics elements (~580 lines)
│   │   │
│   │   └── factories/
│   │       ├── index.ts
│   │       └── element-factory.ts  # Element creation (~329 lines)
│   │
│   ├── parsers/
│   │   ├── index.ts
│   │   ├── base.ts                 # BaseElementParser (~145 lines)
│   │   ├── registry.ts             # Parser registry (~155 lines)
│   │   ├── utils.ts                # Parsing utilities (~80 lines)
│   │   └── elements/
│   │       ├── index.ts
│   │       ├── symbol-parser.ts    # Symbol parsing (~796 lines)
│   │       ├── graphics-parser.ts  # Graphics parsing (~555 lines)
│   │       ├── sheet-parser.ts     # Sheet parsing (~351 lines)
│   │       ├── text-parser.ts      # Text parsing (~275 lines)
│   │       ├── wire-parser.ts      # Wire parsing (~235 lines)
│   │       ├── label-parser.ts     # Label parsing (~211 lines)
│   │       ├── library-parser.ts   # Library parsing (~162 lines)
│   │       └── metadata-parser.ts  # Metadata parsing (~54 lines)
│   │
│   ├── library/
│   │   ├── index.ts
│   │   └── cache.ts                # SymbolLibraryCache (~1430 lines)
│   │
│   ├── symbols/
│   │   ├── index.ts
│   │   ├── cache.ts                # Symbol caching (~467 lines)
│   │   ├── resolver.ts             # Symbol resolution (~361 lines)
│   │   └── validators.ts           # Symbol validation (~504 lines)
│   │
│   ├── geometry/
│   │   ├── index.ts
│   │   ├── routing.ts              # Manhattan routing (~202 lines)
│   │   ├── symbol-bbox.ts          # Symbol bounding boxes (~608 lines)
│   │   └── font-metrics.ts         # Font measurements (~22 lines)
│   │
│   ├── validation/
│   │   ├── index.ts
│   │   ├── erc.ts                  # Electrical Rules Checker (~167 lines)
│   │   ├── erc-models.ts           # ERC data models (~200 lines)
│   │   ├── validators.ts           # Individual validators (~419 lines)
│   │   └── pin-matrix.ts           # Pin conflict matrix (~242 lines)
│   │
│   ├── bom/
│   │   ├── index.ts
│   │   ├── auditor.ts              # BOM property auditor (~297 lines)
│   │   └── matcher.ts              # Property matcher (~85 lines)
│   │
│   ├── discovery/
│   │   ├── index.ts
│   │   └── search-index.ts         # SQLite search index (~456 lines)
│   │
│   ├── exporters/
│   │   ├── index.ts
│   │   ├── python-generator.ts     # Python code generator (~607 lines)
│   │   └── templates/              # Jinja2-style templates
│   │
│   ├── wrappers/
│   │   ├── index.ts
│   │   ├── base.ts                 # ElementWrapper base (~89 lines)
│   │   └── wire.ts                 # WireWrapper (~198 lines)
│   │
│   ├── interfaces/
│   │   ├── index.ts
│   │   ├── parser.ts               # IElementParser, ISchematicParser (~76 lines)
│   │   ├── repository.ts           # ISchematicRepository (~70 lines)
│   │   └── resolver.ts             # ISymbolResolver (~117 lines)
│   │
│   ├── utils/
│   │   ├── index.ts
│   │   ├── validation.ts           # Validation utilities (~448 lines)
│   │   ├── text-effects.ts         # Text effects parsing (~324 lines)
│   │   ├── logging.ts              # Logging utilities (~545 lines)
│   │   └── logging-decorators.ts   # Logging decorators (~578 lines)
│   │
│   └── adapters/
│       ├── cli/
│       │   ├── index.ts            # CLI entry point (~247 lines)
│       │   ├── base.ts             # Base CLI (~313 lines)
│       │   ├── types.ts            # CLI types (~43 lines)
│       │   ├── bom.ts              # BOM command (~167 lines)
│       │   ├── bom-manage.ts       # BOM manage command (~347 lines)
│       │   ├── erc.ts              # ERC command (~235 lines)
│       │   ├── export-docs.ts      # Export docs command (~289 lines)
│       │   ├── find-libraries.ts   # Find libraries command (~395 lines)
│       │   ├── kicad-to-python.ts  # Convert to Python (~147 lines)
│       │   ├── netlist.ts          # Netlist command (~98 lines)
│       │   ├── setup-claude.ts     # Claude setup (~198 lines)
│       │   └── demo.ts             # Demo command (~367 lines)
│       │
│       └── mcp/
│           ├── index.ts
│           ├── server.ts           # MCP server (~366 lines)
│           ├── models.ts           # MCP models (~252 lines)
│           └── tools/
│               ├── index.ts
│               ├── consolidated.ts # 8 consolidated tools (~1480 lines)
│               ├── component.ts    # Component tools (~516 lines)
│               ├── connectivity.ts # Connectivity tools (~795 lines)
│               └── pin-discovery.ts # Pin discovery (~333 lines)
│
├── test/
│   ├── fixtures/                   # Reference .kicad_sch files (copy from Python)
│   │   ├── blank/
│   │   ├── single_resistor/
│   │   ├── rotated_resistor_0deg/
│   │   ├── rotated_resistor_90deg/
│   │   ├── rotated_resistor_180deg/
│   │   ├── rotated_resistor_270deg/
│   │   ├── junction/
│   │   ├── label_rotations/
│   │   ├── hierarchical_label_rotations/
│   │   ├── no_connect/
│   │   ├── rectangles/
│   │   ├── multi_unit_tl072/
│   │   ├── property_positioning_resistor/
│   │   ├── property_positioning_capacitor/
│   │   ├── property_positioning_diode/
│   │   ├── property_positioning_transistor_bjt/
│   │   ├── pin_uuid_preservation/
│   │   ├── connectivity/
│   │   │   ├── simple_connection/
│   │   │   ├── label_connection/
│   │   │   └── hierarchical_connection/
│   │   ├── text/
│   │   ├── image/
│   │   └── hierarchical/
│   │
│   ├── unit/                       # Unit tests
│   │   ├── parser.test.ts
│   │   ├── formatter.test.ts
│   │   ├── types.test.ts
│   │   └── geometry.test.ts
│   │
│   ├── integration/                # Integration tests
│   │   ├── round-trip.test.ts
│   │   ├── components.test.ts
│   │   ├── wires.test.ts
│   │   ├── labels.test.ts
│   │   ├── connectivity.test.ts
│   │   └── hierarchy.test.ts
│   │
│   └── e2e/                        # End-to-end tests
│       ├── cli.test.ts
│       └── mcp.test.ts
│
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## Core Data Types (MANDATORY)

These types, ported from `kicad_sch_api/core/types.py` (~894 lines), are the foundation. They MUST be implemented in `src/core/types.ts`.

### Basic Geometry

```typescript
// src/core/types.ts

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  topLeft: Point;
  bottomRight: Point;
}

export interface Size {
  width: number;
  height: number;
}
```

### Enums

```typescript
export enum PinType {
  INPUT = "input",
  OUTPUT = "output",
  BIDIRECTIONAL = "bidirectional",
  TRISTATE = "tri_state",
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
  TRISTATE = "tri_state",
  PASSIVE = "passive",
  UNSPECIFIED = "unspecified",
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
  COLOR = "color",
}

export enum JustifyHorizontal {
  LEFT = "left",
  CENTER = "center",
  RIGHT = "right",
}

export enum JustifyVertical {
  TOP = "top",
  CENTER = "center",
  BOTTOM = "bottom",
}
```

### Core Data Structures

```typescript
export interface SchematicPin {
  number: string;
  name: string;
  position: Point;
  pinType: PinType;
  pinShape: PinShape;
  length: number;
  rotation: number;
  uuid: string;
}

export interface PinInfo {
  number: string;
  name: string;
  position: Point;
  electricalType: PinType;
  shape: PinShape;
  length: number;
  orientation: number;
  uuid: string;
}

export interface TextEffects {
  position?: Point;
  rotation: number;
  fontFace?: string;
  fontSize: [number, number]; // [height, width]
  fontThickness?: number;
  bold: boolean;
  italic: boolean;
  color?: [number, number, number, number]; // RGBA
  justifyH?: JustifyHorizontal;
  justifyV?: JustifyVertical;
  visible: boolean;
}

export interface PropertyValue {
  name: string;
  value: string;
  position: Point;
  rotation: number;
  effects: TextEffects;
  showName: boolean;
}

export interface SchematicSymbol {
  uuid: string;
  libId: string;
  position: Point;
  rotation: number;
  mirror?: "x" | "y";
  unit: number;
  excludeFromSim: boolean;
  inBom: boolean;
  onBoard: boolean;
  dnp: boolean;
  fieldsAutoplaced: boolean;
  properties: Map<string, PropertyValue>;
  pins: Map<string, string>; // pin number -> pin UUID
  instances: SymbolInstance[];
}

export interface SymbolInstance {
  project: string;
  path: string;
  reference: string;
  unit: number;
}

export interface Wire {
  uuid: string;
  points: Point[];
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
}

export interface Bus {
  uuid: string;
  points: Point[];
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
}

export interface BusEntry {
  uuid: string;
  position: Point;
  size: Point;
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
}

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

export interface Label {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  effects: TextEffects;
  fieldsAutoplaced: boolean;
}

export interface GlobalLabel {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  shape: HierarchicalLabelShape;
  effects: TextEffects;
  fieldsAutoplaced: boolean;
  properties: Map<string, PropertyValue>;
}

export interface HierarchicalLabel {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  shape: HierarchicalLabelShape;
  effects: TextEffects;
  fieldsAutoplaced: boolean;
}

export interface Text {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  effects: TextEffects;
  excludeFromSim: boolean;
}

export interface TextBox {
  uuid: string;
  text: string;
  position: Point;
  size: Size;
  rotation: number;
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
  fillType: FillType;
  fillColor: [number, number, number, number];
  effects: TextEffects;
  excludeFromSim: boolean;
}

export interface SchematicRectangle {
  uuid: string;
  start: Point;
  end: Point;
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
  fillType: FillType;
  fillColor: [number, number, number, number];
}

export interface SchematicCircle {
  uuid: string;
  center: Point;
  radius: number;
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
  fillType: FillType;
  fillColor: [number, number, number, number];
}

export interface SchematicArc {
  uuid: string;
  start: Point;
  mid: Point;
  end: Point;
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
  fillType: FillType;
  fillColor: [number, number, number, number];
}

export interface SchematicPolyline {
  uuid: string;
  points: Point[];
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
}

export interface Image {
  uuid: string;
  position: Point;
  scale: number;
  data: string; // Base64-encoded PNG
}

export interface Sheet {
  uuid: string;
  position: Point;
  size: Size;
  fieldsAutoplaced: boolean;
  strokeWidth: number;
  strokeType: StrokeType;
  strokeColor: [number, number, number, number];
  fillColor: [number, number, number, number];
  name: PropertyValue;
  filename: PropertyValue;
  pins: SheetPin[];
  instances: SheetInstance[];
}

export interface SheetPin {
  uuid: string;
  name: string;
  position: Point;
  shape: HierarchicalLabelShape;
  effects: TextEffects;
}

export interface SheetInstance {
  project: string;
  path: string;
  page: string;
}

export interface TitleBlock {
  title?: string;
  date?: string;
  rev?: string;
  company?: string;
  comment: Map<number, string>; // comment1, comment2, etc.
}

export interface Net {
  name: string;
  code: number;
  pins: Array<{ reference: string; pin: string }>;
  labels: string[];
  wires: string[];
}

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

export interface SymbolGraphics {
  type: "rectangle" | "circle" | "arc" | "polyline" | "text";
  // ... specific properties for each type
}

export interface SymbolPin {
  number: string;
  name: string;
  position: Point;
  length: number;
  rotation: number;
  electricalType: PinType;
  graphicStyle: PinShape;
  nameEffects: TextEffects;
  numberEffects: TextEffects;
  hide: boolean;
  alternate: AlternatePin[];
}

export interface AlternatePin {
  name: string;
  electricalType: PinType;
  graphicStyle: PinShape;
}
```

### Helper Functions

```typescript
// src/core/geometry.ts

export function createPoint(x: number, y: number): Point {
  return { x, y };
}

export function distanceBetween(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function offsetPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

export function snapToGrid(position: Point, gridSize: number = 1.27): Point {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

export function rotatePoint(
  p: Point,
  center: Point,
  angleDegrees: number
): Point {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function transformPinToSchematic(
  pinLocalPosition: Point,
  componentPosition: Point,
  componentRotation: number = 0,
  mirror?: "x" | "y"
): Point {
  // Negate Y for symbol-to-schematic transformation
  let x = pinLocalPosition.x;
  let y = -pinLocalPosition.y; // CRITICAL: Y-negation

  // Apply mirror if present
  if (mirror === "x") {
    x = -x;
  } else if (mirror === "y") {
    y = -y;
  }

  // Apply rotation
  const rad = (componentRotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotatedX = x * cos - y * sin;
  const rotatedY = x * sin + y * cos;

  // Translate to component position
  return {
    x: componentPosition.x + rotatedX,
    y: componentPosition.y + rotatedY,
  };
}
```

---

## S-Expression Parser & Formatter

The most critical task is parsing and formatting the `.kicad_sch` S-expression format **with exact preservation**.

### Parser (`src/core/parser.ts`)

Port from `kicad_sch_api/core/parser.py` (~703 lines).

```typescript
// src/core/parser.ts

export type SExpAtom = string | number | Symbol;
export type SExp = SExpAtom | SExp[];

export class Symbol {
  constructor(public readonly name: string) {}
  toString(): string {
    return this.name;
  }
}

export interface Token {
  type: "lparen" | "rparen" | "string" | "number" | "symbol";
  value: string | number;
  line: number;
  column: number;
}

export class SExpressionParser {
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private input: string = "";

  parse(input: string): SExp {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    return this.parseExpression();
  }

  private parseExpression(): SExp {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      throw new ParseError("Unexpected end of input", this.line, this.column);
    }

    const char = this.input[this.pos];

    if (char === "(") {
      return this.parseList();
    } else if (char === '"') {
      return this.parseString();
    } else if (
      this.isDigit(char) ||
      (char === "-" && this.isDigit(this.peek(1)))
    ) {
      return this.parseNumber();
    } else {
      return this.parseSymbol();
    }
  }

  private parseList(): SExp[] {
    this.expect("(");
    const result: SExp[] = [];

    this.skipWhitespace();
    while (this.pos < this.input.length && this.input[this.pos] !== ")") {
      result.push(this.parseExpression());
      this.skipWhitespace();
    }

    this.expect(")");
    return result;
  }

  private parseString(): string {
    this.expect('"');
    let result = "";

    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === "\\" && this.pos + 1 < this.input.length) {
        this.pos++;
        this.column++;
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
          case '"':
            result += '"';
            break;
          case "\\":
            result += "\\";
            break;
          default:
            result += escaped;
        }
      } else {
        result += this.input[this.pos];
      }
      this.advance();
    }

    this.expect('"');
    return result;
  }

  private parseNumber(): number {
    const start = this.pos;

    if (this.input[this.pos] === "-") {
      this.advance();
    }

    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      this.advance();
    }

    if (this.pos < this.input.length && this.input[this.pos] === ".") {
      this.advance();
      while (
        this.pos < this.input.length &&
        this.isDigit(this.input[this.pos])
      ) {
        this.advance();
      }
    }

    // Handle scientific notation
    if (
      this.pos < this.input.length &&
      (this.input[this.pos] === "e" || this.input[this.pos] === "E")
    ) {
      this.advance();
      if (this.input[this.pos] === "+" || this.input[this.pos] === "-") {
        this.advance();
      }
      while (
        this.pos < this.input.length &&
        this.isDigit(this.input[this.pos])
      ) {
        this.advance();
      }
    }

    return parseFloat(this.input.slice(start, this.pos));
  }

  private parseSymbol(): Symbol {
    const start = this.pos;

    while (
      this.pos < this.input.length &&
      this.isSymbolChar(this.input[this.pos])
    ) {
      this.advance();
    }

    return new Symbol(this.input.slice(start, this.pos));
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
      } else if (char === "\n") {
        this.pos++;
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

  private expect(char: string): void {
    if (this.input[this.pos] !== char) {
      throw new ParseError(
        `Expected '${char}', got '${this.input[this.pos]}'`,
        this.line,
        this.column
      );
    }
    this.advance();
  }

  private peek(offset: number): string {
    return this.input[this.pos + offset] || "";
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isSymbolChar(char: string): boolean {
    return (
      char !== "(" &&
      char !== ")" &&
      char !== '"' &&
      char !== " " &&
      char !== "\t" &&
      char !== "\n" &&
      char !== "\r"
    );
  }
}

export class ParseError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = "ParseError";
  }
}
```

### Formatter (`src/core/formatter.ts`)

Port from `kicad_sch_api/core/formatter.py` (~583 lines). This is the **hardest part** of the port.

```typescript
// src/core/formatter.ts

export interface FormatRule {
  inline: boolean; // Format on single line
  quoteValue: boolean; // Quote the value
  childrenInline: boolean; // Children on same line
  indentChildren: boolean; // Indent children
  newlineBefore: boolean; // Newline before this element
  newlineAfter: boolean; // Newline after this element
}

export class ExactFormatter {
  private static readonly INLINE_ELEMENTS = new Set([
    "version",
    "generator",
    "generator_version",
    "uuid",
    "paper",
    "at",
    "xy",
    "pts",
    "start",
    "end",
    "mid",
    "center",
    "radius",
    "length",
    "size",
    "stroke",
    "fill",
    "color",
    "diameter",
    "font",
    "justify",
    "hide",
    "effects",
    "in_bom",
    "on_board",
    "exclude_from_sim",
    "dnp",
    "fields_autoplaced",
    "number",
    "name",
    "offset",
  ]);

  private static readonly QUOTED_VALUES = new Set([
    "uuid",
    "generator",
    "paper",
    "lib_id",
    "lib_name",
    "property",
    "name",
    "value",
    "footprint",
    "datasheet",
    "title",
    "company",
    "rev",
    "date",
    "comment",
  ]);

  private static readonly BLOCK_ELEMENTS = new Set([
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
    "circle",
    "arc",
    "polyline",
    "image",
    "sheet",
    "sheet_instances",
    "symbol_instances",
  ]);

  format(sexp: SExp, indent: number = 0): string {
    if (Array.isArray(sexp)) {
      return this.formatList(sexp, indent);
    } else if (sexp instanceof Symbol) {
      return sexp.name;
    } else if (typeof sexp === "string") {
      return this.formatString(sexp);
    } else if (typeof sexp === "number") {
      return this.formatNumber(sexp);
    }
    return String(sexp);
  }

  private formatList(list: SExp[], indent: number): string {
    if (list.length === 0) {
      return "()";
    }

    const tag = list[0] instanceof Symbol ? list[0].name : null;
    const isInline = tag && ExactFormatter.INLINE_ELEMENTS.has(tag);
    const isBlock = tag && ExactFormatter.BLOCK_ELEMENTS.has(tag);

    if (isInline || this.shouldBeInline(list)) {
      return this.formatInline(list);
    }

    return this.formatBlock(list, indent);
  }

  private formatInline(list: SExp[]): string {
    const parts = list.map((item) => this.format(item, 0));
    return "(" + parts.join(" ") + ")";
  }

  private formatBlock(list: SExp[], indent: number): string {
    const tag = list[0] instanceof Symbol ? list[0].name : null;
    const indentStr = "\t".repeat(indent);
    const childIndentStr = "\t".repeat(indent + 1);

    let result = "(";

    // Format first element (tag)
    result += this.format(list[0], indent);

    // Format remaining elements
    for (let i = 1; i < list.length; i++) {
      const item = list[i];
      const itemTag =
        Array.isArray(item) && item[0] instanceof Symbol ? item[0].name : null;

      if (this.shouldBeInline(item)) {
        result += " " + this.format(item, indent + 1);
      } else {
        result += "\n" + childIndentStr + this.format(item, indent + 1);
      }
    }

    result += "\n" + indentStr + ")";
    return result;
  }

  private shouldBeInline(sexp: SExp): boolean {
    if (!Array.isArray(sexp)) return true;
    if (sexp.length === 0) return true;

    const tag = sexp[0] instanceof Symbol ? sexp[0].name : null;
    if (tag && ExactFormatter.INLINE_ELEMENTS.has(tag)) return true;

    // Check if all children are atoms or inline elements
    for (let i = 1; i < sexp.length; i++) {
      if (Array.isArray(sexp[i])) {
        const childTag = sexp[i][0] instanceof Symbol ? sexp[i][0].name : null;
        if (!childTag || !ExactFormatter.INLINE_ELEMENTS.has(childTag)) {
          // Check depth - if nested too deep, not inline
          if (this.getDepth(sexp[i]) > 2) return false;
        }
      }
    }

    return sexp.length <= 4;
  }

  private getDepth(sexp: SExp): number {
    if (!Array.isArray(sexp)) return 0;
    let maxDepth = 0;
    for (const item of sexp) {
      maxDepth = Math.max(maxDepth, this.getDepth(item));
    }
    return maxDepth + 1;
  }

  private formatString(s: string): string {
    // Escape special characters
    const escaped = s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");
    return '"' + escaped + '"';
  }

  private formatNumber(n: number): string {
    // KiCAD uses specific number formatting
    if (Number.isInteger(n)) {
      return n.toString();
    }

    // Format with appropriate decimal places
    // KiCAD typically uses up to 6 decimal places, but removes trailing zeros
    let formatted = n.toFixed(6);

    // Remove trailing zeros after decimal point
    if (formatted.includes(".")) {
      formatted = formatted.replace(/\.?0+$/, "");
    }

    return formatted;
  }
}
```

### Round-Trip Test

The formatter MUST pass this test:

```typescript
// test/unit/formatter.test.ts
import { readFileSync } from "fs";
import { SExpressionParser } from "../src/core/parser";
import { ExactFormatter } from "../src/core/formatter";

describe("Round-Trip Format Preservation", () => {
  const parser = new SExpressionParser();
  const formatter = new ExactFormatter();

  it("should parse and format a reference file identically", () => {
    const original = readFileSync(
      "test/fixtures/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch",
      "utf-8"
    );
    const parsed = parser.parse(original);
    const formatted = formatter.format(parsed);
    expect(formatted).toEqual(original.trim());
  });

  // Test all reference files
  const fixtures = [
    "blank/blank.kicad_sch",
    "single_resistor/single_resistor.kicad_sch",
    "rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch",
    "rotated_resistor_90deg/rotated_resistor_90deg.kicad_sch",
    "rotated_resistor_180deg/rotated_resistor_180deg.kicad_sch",
    "junction/junction.kicad_sch",
    "label_rotations/label_rotations.kicad_sch",
    "no_connect/no_connect.kicad_sch",
  ];

  fixtures.forEach((fixture) => {
    it(`should round-trip ${fixture}`, () => {
      const original = readFileSync(`test/fixtures/${fixture}`, "utf-8");
      const parsed = parser.parse(original);
      const formatted = formatter.format(parsed);
      expect(formatted).toEqual(original.trim());
    });
  });
});
```

---

## Configuration System

Port from `kicad_sch_api/core/config.py` (~235 lines).

```typescript
// src/core/config.ts

export interface GridSettings {
  defaultSize: number; // Default grid size in mm (1.27 = 50 mil)
  componentSpacing: number; // Default spacing between components
  wireSnapTolerance: number; // Tolerance for wire endpoint snapping
}

export interface PositioningSettings {
  useGridUnits: boolean; // If true, positions are in grid units (1 unit = 1.27mm)
  referenceOffsetY: number; // Y offset for Reference property
  valueOffsetY: number; // Y offset for Value property
  footprintOffsetX: number; // X offset for Footprint property
}

export interface ToleranceSettings {
  positionTolerance: number; // Tolerance for position comparisons
  angleTolerance: number; // Tolerance for angle comparisons
}

export interface PropertyPositionConfig {
  referenceY: number;
  valueY: number;
  footprintX: number;
  footprintY: number;
}

export class KiCADConfig {
  grid: GridSettings = {
    defaultSize: 1.27,
    componentSpacing: 5.08,
    wireSnapTolerance: 0.01,
  };

  positioning: PositioningSettings = {
    useGridUnits: false,
    referenceOffsetY: -2.54,
    valueOffsetY: 2.54,
    footprintOffsetX: -5.08,
  };

  tolerance: ToleranceSettings = {
    positionTolerance: 0.001,
    angleTolerance: 0.01,
  };

  properties: PropertyPositionConfig = {
    referenceY: -2.54,
    valueY: 2.54,
    footprintX: 0,
    footprintY: 5.08,
  };

  /**
   * Calculate property position relative to component, accounting for rotation.
   */
  getPropertyPosition(
    propertyName: string,
    componentPos: Point,
    componentRotation: number
  ): Point {
    let offsetX = 0;
    let offsetY = 0;

    switch (propertyName) {
      case "Reference":
        offsetY = this.properties.referenceY;
        break;
      case "Value":
        offsetY = this.properties.valueY;
        break;
      case "Footprint":
        offsetX = this.properties.footprintX;
        offsetY = this.properties.footprintY;
        break;
    }

    // Apply rotation to offset
    const rad = (componentRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return {
      x: componentPos.x + offsetX * cos - offsetY * sin,
      y: componentPos.y + offsetX * sin + offsetY * cos,
    };
  }
}

// Global configuration instance
export const config = new KiCADConfig();

// Common S-expression field names (to avoid typos)
export const SExpFields = {
  KICAD_SCH: "kicad_sch",
  VERSION: "version",
  GENERATOR: "generator",
  UUID: "uuid",
  PAPER: "paper",
  TITLE_BLOCK: "title_block",
  LIB_SYMBOLS: "lib_symbols",
  SYMBOL: "symbol",
  WIRE: "wire",
  BUS: "bus",
  JUNCTION: "junction",
  NO_CONNECT: "no_connect",
  LABEL: "label",
  GLOBAL_LABEL: "global_label",
  HIERARCHICAL_LABEL: "hierarchical_label",
  TEXT: "text",
  TEXT_BOX: "text_box",
  RECTANGLE: "rectangle",
  SHEET: "sheet",
  SHEET_INSTANCES: "sheet_instances",
  SYMBOL_INSTANCES: "symbol_instances",
  // ... add all field names
} as const;
```

---

## Exceptions

Port from `kicad_sch_api/core/exceptions.py` (~180 lines).

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
    super(
      line && column ? `${message} at line ${line}, column ${column}` : message
    );
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
  constructor(message: string, public field?: string, public value?: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ElementNotFoundError extends KiCadSchError {
  constructor(public elementType: string, public identifier: string) {
    super(`${elementType} not found: ${identifier}`);
    this.name = "ElementNotFoundError";
  }
}

export class DuplicateElementError extends KiCadSchError {
  constructor(public elementType: string, public identifier: string) {
    super(`Duplicate ${elementType}: ${identifier}`);
    this.name = "DuplicateElementError";
  }
}

export class LibraryError extends KiCadSchError {
  constructor(message: string, public libraryPath?: string) {
    super(message);
    this.name = "LibraryError";
  }
}

export class SymbolNotFoundError extends LibraryError {
  constructor(public libId: string) {
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
  constructor(message: string, public sheetPath?: string) {
    super(message);
    this.name = "HierarchyError";
  }
}

export class CodeGenerationError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "CodeGenerationError";
  }
}
```

---

## Collection Classes

Port from `kicad_sch_api/collections/` and `kicad_sch_api/core/collections/`.

### Base Collection (`src/core/collections/base.ts`)

Port from `kicad_sch_api/collections/base.py` (~626 lines).

```typescript
// src/core/collections/base.ts

export interface IndexSpec<T> {
  name: string;
  keyFn: (item: T) => string | undefined;
  unique: boolean;
}

export class IndexRegistry<T> {
  private indices: Map<string, Map<string, T | T[]>> = new Map();
  private specs: Map<string, IndexSpec<T>> = new Map();

  addIndex(spec: IndexSpec<T>): void {
    this.specs.set(spec.name, spec);
    this.indices.set(spec.name, new Map());
  }

  index(item: T): void {
    for (const [name, spec] of this.specs) {
      const key = spec.keyFn(item);
      if (key === undefined) continue;

      const index = this.indices.get(name)!;
      if (spec.unique) {
        index.set(key, item);
      } else {
        const existing = index.get(key) as T[] | undefined;
        if (existing) {
          existing.push(item);
        } else {
          index.set(key, [item]);
        }
      }
    }
  }

  unindex(item: T): void {
    for (const [name, spec] of this.specs) {
      const key = spec.keyFn(item);
      if (key === undefined) continue;

      const index = this.indices.get(name)!;
      if (spec.unique) {
        index.delete(key);
      } else {
        const existing = index.get(key) as T[] | undefined;
        if (existing) {
          const idx = existing.indexOf(item);
          if (idx !== -1) existing.splice(idx, 1);
          if (existing.length === 0) index.delete(key);
        }
      }
    }
  }

  get(indexName: string, key: string): T | T[] | undefined {
    return this.indices.get(indexName)?.get(key);
  }

  getUnique(indexName: string, key: string): T | undefined {
    return this.indices.get(indexName)?.get(key) as T | undefined;
  }

  getAll(indexName: string, key: string): T[] {
    const result = this.indices.get(indexName)?.get(key);
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  }
}

export enum ValidationLevel {
  NONE = "none",
  WARN = "warn",
  ERROR = "error",
}

export abstract class BaseCollection<T> implements Iterable<T> {
  protected items: T[] = [];
  protected indexRegistry: IndexRegistry<T> = new IndexRegistry();
  protected validationLevel: ValidationLevel = ValidationLevel.ERROR;
  protected modified: boolean = false;

  constructor() {
    this.setupIndices();
  }

  protected abstract setupIndices(): void;
  protected abstract validateItem(item: T): void;
  protected abstract getItemId(item: T): string;

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

  add(item: T): T {
    this.validateItem(item);
    this.items.push(item);
    this.indexRegistry.index(item);
    this.modified = true;
    return item;
  }

  remove(identifier: string): boolean {
    const item = this.get(identifier);
    if (!item) return false;

    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.indexRegistry.unindex(item);
      this.modified = true;
      return true;
    }
    return false;
  }

  abstract get(identifier: string): T | undefined;

  getByUuid(uuid: string): T | undefined {
    return this.indexRegistry.getUnique("uuid", uuid);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  map<U>(fn: (item: T) => U): U[] {
    return this.items.map(fn);
  }

  forEach(fn: (item: T) => void): void {
    this.items.forEach(fn);
  }

  clear(): void {
    for (const item of this.items) {
      this.indexRegistry.unindex(item);
    }
    this.items = [];
    this.modified = true;
  }

  markClean(): void {
    this.modified = false;
  }
}
```

### Component Collection (`src/core/collections/components.ts`)

Port from `kicad_sch_api/collections/components.py` (~2008 lines). This is the largest collection.

```typescript
// src/core/collections/components.ts

export interface AddComponentOptions {
  libId: string;
  reference: string;
  value: string;
  position: Point;
  rotation?: number;
  mirror?: "x" | "y";
  footprint?: string;
  unit?: number;
  uuid?: string;
  properties?: Record<string, string>;
  inBom?: boolean;
  onBoard?: boolean;
  excludeFromSim?: boolean;
  dnp?: boolean;
}

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
  get excludeFromSim(): boolean {
    return this.symbol.excludeFromSim;
  }
  get dnp(): boolean {
    return this.symbol.dnp;
  }

  get reference(): string {
    return this.getProperty("Reference") || "";
  }

  set reference(value: string) {
    this.setProperty("Reference", value);
  }

  get value(): string {
    return this.getProperty("Value") || "";
  }

  set value(value: string) {
    this.setProperty("Value", value);
  }

  get footprint(): string | undefined {
    return this.getProperty("Footprint");
  }

  set footprint(value: string | undefined) {
    if (value) {
      this.setProperty("Footprint", value);
    }
  }

  get datasheet(): string | undefined {
    return this.getProperty("Datasheet");
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

  setProperty(
    name: string,
    value: string,
    options?: { hidden?: boolean; position?: Point }
  ): void {
    const existing = this.symbol.properties.get(name);
    if (existing) {
      existing.value = value;
      if (options?.hidden !== undefined) {
        existing.effects.visible = !options.hidden;
      }
      if (options?.position) {
        existing.position = options.position;
      }
    } else {
      // Create new property
      this.symbol.properties.set(name, {
        name,
        value,
        position: options?.position || this.position,
        rotation: 0,
        effects: {
          rotation: 0,
          fontSize: [1.27, 1.27],
          bold: false,
          italic: false,
          visible: options?.hidden !== true,
        },
        showName: false,
      });
    }
    this.collection.markModified();
  }

  hideProperty(name: string): void {
    const prop = this.symbol.properties.get(name);
    if (prop) {
      prop.effects.visible = false;
      this.collection.markModified();
    }
  }

  showProperty(name: string): void {
    const prop = this.symbol.properties.get(name);
    if (prop) {
      prop.effects.visible = true;
      this.collection.markModified();
    }
  }

  getPropertyEffects(name: string): TextEffects | undefined {
    return this.symbol.properties.get(name)?.effects;
  }

  setPropertyEffects(name: string, effects: Partial<TextEffects>): void {
    const prop = this.symbol.properties.get(name);
    if (prop) {
      Object.assign(prop.effects, effects);
      this.collection.markModified();
    }
  }

  getPinPosition(pinNumber: string): Point | undefined {
    // This requires symbol library lookup to get pin local position
    // Then transform to schematic space
    // Implementation depends on SymbolLibraryCache
    throw new Error("Not implemented - requires SymbolLibraryCache");
  }

  moveTo(position: Point): void {
    this.symbol.position = position;
    this.collection.markModified();
  }

  rotate(degrees: number): void {
    this.symbol.rotation = (this.symbol.rotation + degrees) % 360;
    this.collection.markModified();
  }

  toSymbol(): SchematicSymbol {
    return this.symbol;
  }
}

export class ComponentCollection extends BaseCollection<Component> {
  private schematic: Schematic;

  constructor(schematic: Schematic) {
    super();
    this.schematic = schematic;
  }

  protected setupIndices(): void {
    this.indexRegistry.addIndex({
      name: "uuid",
      keyFn: (c) => c.uuid,
      unique: true,
    });
    this.indexRegistry.addIndex({
      name: "reference",
      keyFn: (c) => c.reference,
      unique: true,
    });
    this.indexRegistry.addIndex({
      name: "libId",
      keyFn: (c) => c.libId,
      unique: false,
    });
  }

  protected validateItem(item: Component): void {
    if (!item.libId) {
      throw new ValidationError("Component must have a libId");
    }
    if (!item.reference) {
      throw new ValidationError("Component must have a reference");
    }
  }

  protected getItemId(item: Component): string {
    return item.reference;
  }

  get(reference: string): Component | undefined {
    return this.indexRegistry.getUnique("reference", reference);
  }

  add(options: AddComponentOptions): Component {
    const symbol: SchematicSymbol = {
      uuid: options.uuid || crypto.randomUUID(),
      libId: options.libId,
      position: options.position,
      rotation: options.rotation || 0,
      mirror: options.mirror,
      unit: options.unit || 1,
      excludeFromSim: options.excludeFromSim || false,
      inBom: options.inBom !== false,
      onBoard: options.onBoard !== false,
      dnp: options.dnp || false,
      fieldsAutoplaced: true,
      properties: new Map(),
      pins: new Map(),
      instances: [],
    };

    // Add standard properties
    symbol.properties.set("Reference", {
      name: "Reference",
      value: options.reference,
      position: config.getPropertyPosition(
        "Reference",
        options.position,
        options.rotation || 0
      ),
      rotation: 0,
      effects: {
        rotation: 0,
        fontSize: [1.27, 1.27],
        bold: false,
        italic: false,
        visible: true,
      },
      showName: false,
    });

    symbol.properties.set("Value", {
      name: "Value",
      value: options.value,
      position: config.getPropertyPosition(
        "Value",
        options.position,
        options.rotation || 0
      ),
      rotation: 0,
      effects: {
        rotation: 0,
        fontSize: [1.27, 1.27],
        bold: false,
        italic: false,
        visible: true,
      },
      showName: false,
    });

    if (options.footprint) {
      symbol.properties.set("Footprint", {
        name: "Footprint",
        value: options.footprint,
        position: config.getPropertyPosition(
          "Footprint",
          options.position,
          options.rotation || 0
        ),
        rotation: 0,
        effects: {
          rotation: 0,
          fontSize: [1.27, 1.27],
          bold: false,
          italic: false,
          visible: false,
        },
        showName: false,
      });
    }

    // Add custom properties
    if (options.properties) {
      for (const [name, value] of Object.entries(options.properties)) {
        if (!symbol.properties.has(name)) {
          symbol.properties.set(name, {
            name,
            value,
            position: options.position,
            rotation: 0,
            effects: {
              rotation: 0,
              fontSize: [1.27, 1.27],
              bold: false,
              italic: false,
              visible: false,
            },
            showName: false,
          });
        }
      }
    }

    const component = new Component(symbol, this);
    return super.add(component);
  }

  findByLibId(libIdPattern: string): Component[] {
    if (libIdPattern.includes("*")) {
      const regex = new RegExp("^" + libIdPattern.replace(/\*/g, ".*") + "$");
      return this.filter((c) => regex.test(c.libId));
    }
    return this.indexRegistry.getAll("libId", libIdPattern);
  }

  bulkUpdate(
    criteria: { libId?: string; reference?: string },
    updates: { properties?: Record<string, string> }
  ): number {
    let count = 0;
    for (const component of this.items) {
      let matches = true;
      if (criteria.libId && component.libId !== criteria.libId) matches = false;
      if (criteria.reference && component.reference !== criteria.reference)
        matches = false;

      if (matches) {
        if (updates.properties) {
          for (const [name, value] of Object.entries(updates.properties)) {
            component.setProperty(name, value);
          }
        }
        count++;
      }
    }
    return count;
  }

  markModified(): void {
    this.modified = true;
  }
}
```

### Wire Collection (`src/core/collections/wires.ts`)

Port from `kicad_sch_api/collections/wires.py` (~298 lines).

```typescript
// src/core/collections/wires.ts

export interface AddWireOptions {
  start?: Point;
  end?: Point;
  points?: Point[];
  uuid?: string;
  strokeWidth?: number;
  strokeType?: StrokeType;
}

export class WireCollection extends BaseCollection<Wire> {
  protected setupIndices(): void {
    this.indexRegistry.addIndex({
      name: "uuid",
      keyFn: (w) => w.uuid,
      unique: true,
    });
  }

  protected validateItem(item: Wire): void {
    if (item.points.length < 2) {
      throw new ValidationError("Wire must have at least 2 points");
    }
  }

  protected getItemId(item: Wire): string {
    return item.uuid;
  }

  get(uuid: string): Wire | undefined {
    return this.indexRegistry.getUnique("uuid", uuid);
  }

  add(options: AddWireOptions): Wire {
    let points: Point[];

    if (options.points) {
      points = options.points;
    } else if (options.start && options.end) {
      points = [options.start, options.end];
    } else {
      throw new ValidationError(
        "Wire must have either points array or start/end"
      );
    }

    const wire: Wire = {
      uuid: options.uuid || crypto.randomUUID(),
      points,
      strokeWidth: options.strokeWidth || 0,
      strokeType: options.strokeType || StrokeType.DEFAULT,
      strokeColor: [0, 0, 0, 0],
    };

    this.items.push(wire);
    this.indexRegistry.index(wire);
    this.modified = true;
    return wire;
  }

  findAtPoint(point: Point, tolerance: number = 0.01): Wire[] {
    return this.filter((wire) => {
      for (const p of wire.points) {
        if (
          Math.abs(p.x - point.x) < tolerance &&
          Math.abs(p.y - point.y) < tolerance
        ) {
          return true;
        }
      }
      return false;
    });
  }

  findConnecting(point: Point, tolerance: number = 0.01): Wire[] {
    return this.filter((wire) => {
      const start = wire.points[0];
      const end = wire.points[wire.points.length - 1];
      return (
        (Math.abs(start.x - point.x) < tolerance &&
          Math.abs(start.y - point.y) < tolerance) ||
        (Math.abs(end.x - point.x) < tolerance &&
          Math.abs(end.y - point.y) < tolerance)
      );
    });
  }
}
```

### Label Collection (`src/core/collections/labels.ts`)

Port from `kicad_sch_api/collections/labels.py` (~510 lines).

```typescript
// src/core/collections/labels.ts

export interface AddLabelOptions {
  text: string;
  position: Point;
  type?: LabelType;
  rotation?: number;
  shape?: HierarchicalLabelShape;
  uuid?: string;
}

export class LabelCollection extends BaseCollection<
  Label | GlobalLabel | HierarchicalLabel
> {
  protected setupIndices(): void {
    this.indexRegistry.addIndex({
      name: "uuid",
      keyFn: (l) => l.uuid,
      unique: true,
    });
    this.indexRegistry.addIndex({
      name: "text",
      keyFn: (l) => l.text,
      unique: false,
    });
  }

  protected validateItem(item: Label | GlobalLabel | HierarchicalLabel): void {
    if (!item.text) {
      throw new ValidationError("Label must have text");
    }
  }

  protected getItemId(item: Label | GlobalLabel | HierarchicalLabel): string {
    return item.uuid;
  }

  get(uuid: string): Label | GlobalLabel | HierarchicalLabel | undefined {
    return this.indexRegistry.getUnique("uuid", uuid);
  }

  add(options: AddLabelOptions): Label | GlobalLabel | HierarchicalLabel {
    const type = options.type || LabelType.LOCAL;
    const uuid = options.uuid || crypto.randomUUID();
    const effects: TextEffects = {
      rotation: options.rotation || 0,
      fontSize: [1.27, 1.27],
      bold: false,
      italic: false,
      visible: true,
    };

    let label: Label | GlobalLabel | HierarchicalLabel;

    switch (type) {
      case LabelType.GLOBAL:
        label = {
          uuid,
          text: options.text,
          position: options.position,
          rotation: options.rotation || 0,
          shape: options.shape || HierarchicalLabelShape.BIDIRECTIONAL,
          effects,
          fieldsAutoplaced: true,
          properties: new Map(),
        } as GlobalLabel;
        break;

      case LabelType.HIERARCHICAL:
        label = {
          uuid,
          text: options.text,
          position: options.position,
          rotation: options.rotation || 0,
          shape: options.shape || HierarchicalLabelShape.BIDIRECTIONAL,
          effects,
          fieldsAutoplaced: true,
        } as HierarchicalLabel;
        break;

      default:
        label = {
          uuid,
          text: options.text,
          position: options.position,
          rotation: options.rotation || 0,
          effects,
          fieldsAutoplaced: true,
        } as Label;
    }

    this.items.push(label);
    this.indexRegistry.index(label);
    this.modified = true;
    return label;
  }

  findByText(text: string): (Label | GlobalLabel | HierarchicalLabel)[] {
    return this.indexRegistry.getAll("text", text);
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
}
```

### Junction Collection (`src/core/collections/junctions.ts`)

```typescript
// src/core/collections/junctions.ts

export interface AddJunctionOptions {
  position: Point;
  uuid?: string;
  diameter?: number;
  color?: [number, number, number, number];
}

export class JunctionCollection extends BaseCollection<Junction> {
  protected setupIndices(): void {
    this.indexRegistry.addIndex({
      name: "uuid",
      keyFn: (j) => j.uuid,
      unique: true,
    });
  }

  protected validateItem(item: Junction): void {
    // Junctions just need a position
  }

  protected getItemId(item: Junction): string {
    return item.uuid;
  }

  get(uuid: string): Junction | undefined {
    return this.indexRegistry.getUnique("uuid", uuid);
  }

  add(options: AddJunctionOptions): Junction {
    const junction: Junction = {
      uuid: options.uuid || crypto.randomUUID(),
      position: options.position,
      diameter: options.diameter || 0,
      color: options.color || [0, 0, 0, 0],
    };

    this.items.push(junction);
    this.indexRegistry.index(junction);
    this.modified = true;
    return junction;
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

### NoConnect Collection (`src/core/collections/no-connects.ts`)

```typescript
// src/core/collections/no-connects.ts

export interface AddNoConnectOptions {
  position: Point;
  uuid?: string;
}

export class NoConnectCollection extends BaseCollection<NoConnect> {
  protected setupIndices(): void {
    this.indexRegistry.addIndex({
      name: "uuid",
      keyFn: (nc) => nc.uuid,
      unique: true,
    });
  }

  protected validateItem(item: NoConnect): void {
    // NoConnects just need a position
  }

  protected getItemId(item: NoConnect): string {
    return item.uuid;
  }

  get(uuid: string): NoConnect | undefined {
    return this.indexRegistry.getUnique("uuid", uuid);
  }

  add(options: AddNoConnectOptions): NoConnect {
    const noConnect: NoConnect = {
      uuid: options.uuid || crypto.randomUUID(),
      position: options.position,
    };

    this.items.push(noConnect);
    this.indexRegistry.index(noConnect);
    this.modified = true;
    return noConnect;
  }
}
```

---

## Manager Classes

Port from `kicad_sch_api/core/managers/`. These are internal classes used by the `Schematic` class.

### Base Manager (`src/core/managers/base.ts`)

```typescript
// src/core/managers/base.ts

export abstract class BaseManager {
  protected schematic: Schematic;

  constructor(schematic: Schematic) {
    this.schematic = schematic;
  }

  protected markModified(): void {
    // Signal that the schematic has been modified
    this.schematic.markModified();
  }
}
```

### FileIO Manager (`src/core/managers/file-io.ts`)

Port from `kicad_sch_api/core/managers/file_io.py` (~246 lines).

```typescript
// src/core/managers/file-io.ts

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";

export class FileIOManager extends BaseManager {
  private filePath?: string;

  getFilePath(): string | undefined {
    return this.filePath;
  }

  setFilePath(path: string): void {
    this.filePath = path;
  }

  getDirectory(): string | undefined {
    return this.filePath ? dirname(this.filePath) : undefined;
  }

  load(filePath: string): string {
    if (!existsSync(filePath)) {
      throw new KiCadSchError(`File not found: ${filePath}`);
    }
    this.filePath = resolve(filePath);
    return readFileSync(filePath, "utf-8");
  }

  save(filePath?: string): void {
    const targetPath = filePath || this.filePath;
    if (!targetPath) {
      throw new KiCadSchError("No file path specified for save");
    }

    const content = this.schematic.format();
    writeFileSync(targetPath, content, "utf-8");
    this.filePath = resolve(targetPath);
  }

  resolveRelativePath(relativePath: string): string {
    const dir = this.getDirectory();
    if (!dir) {
      throw new KiCadSchError(
        "Cannot resolve relative path without a base directory"
      );
    }
    return resolve(dir, relativePath);
  }
}
```

### Metadata Manager (`src/core/managers/metadata.ts`)

Port from `kicad_sch_api/core/managers/metadata.py` (~271 lines).

```typescript
// src/core/managers/metadata.ts

export class MetadataManager extends BaseManager {
  private version: number = 20231120;
  private generator: string = "kicad-sch-ts";
  private generatorVersion: string = "1.0.0";
  private uuid: string = crypto.randomUUID();
  private paper: string = "A4";
  private titleBlock: TitleBlock = { comment: new Map() };

  getVersion(): number {
    return this.version;
  }
  setVersion(version: number): void {
    this.version = version;
    this.markModified();
  }

  getGenerator(): string {
    return this.generator;
  }
  setGenerator(generator: string): void {
    this.generator = generator;
    this.markModified();
  }

  getGeneratorVersion(): string {
    return this.generatorVersion;
  }
  setGeneratorVersion(version: string): void {
    this.generatorVersion = version;
    this.markModified();
  }

  getUuid(): string {
    return this.uuid;
  }
  setUuid(uuid: string): void {
    this.uuid = uuid;
    this.markModified();
  }

  getPaper(): string {
    return this.paper;
  }
  setPaper(paper: string): void {
    this.paper = paper;
    this.markModified();
  }

  getTitleBlock(): TitleBlock {
    return this.titleBlock;
  }

  setTitle(title: string): void {
    this.titleBlock.title = title;
    this.markModified();
  }

  setDate(date: string): void {
    this.titleBlock.date = date;
    this.markModified();
  }

  setRevision(rev: string): void {
    this.titleBlock.rev = rev;
    this.markModified();
  }

  setCompany(company: string): void {
    this.titleBlock.company = company;
    this.markModified();
  }

  setComment(number: number, text: string): void {
    this.titleBlock.comment.set(number, text);
    this.markModified();
  }

  loadFromSexp(sexp: SExp[]): void {
    // Parse version, generator, uuid, paper, title_block from S-expression
    for (const item of sexp) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const tag = item[0] instanceof Symbol ? item[0].name : null;

      switch (tag) {
        case "version":
          this.version = item[1] as number;
          break;
        case "generator":
          this.generator = item[1] as string;
          break;
        case "generator_version":
          this.generatorVersion = item[1] as string;
          break;
        case "uuid":
          this.uuid = item[1] as string;
          break;
        case "paper":
          this.paper = item[1] as string;
          break;
        case "title_block":
          this.parseTitleBlock(item);
          break;
      }
    }
  }

  private parseTitleBlock(sexp: SExp[]): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || item.length < 2) continue;
      const tag = item[0] instanceof Symbol ? item[0].name : null;

      switch (tag) {
        case "title":
          this.titleBlock.title = item[1] as string;
          break;
        case "date":
          this.titleBlock.date = item[1] as string;
          break;
        case "rev":
          this.titleBlock.rev = item[1] as string;
          break;
        case "company":
          this.titleBlock.company = item[1] as string;
          break;
        case "comment":
          if (item.length >= 3) {
            this.titleBlock.comment.set(item[1] as number, item[2] as string);
          }
          break;
      }
    }
  }

  toSexp(): SExp[] {
    const result: SExp[] = [];

    result.push([new Symbol("version"), this.version]);
    result.push([new Symbol("generator"), this.generator]);
    result.push([new Symbol("generator_version"), this.generatorVersion]);
    result.push([new Symbol("uuid"), this.uuid]);
    result.push([new Symbol("paper"), this.paper]);

    if (
      this.titleBlock.title ||
      this.titleBlock.date ||
      this.titleBlock.rev ||
      this.titleBlock.company ||
      this.titleBlock.comment.size > 0
    ) {
      const titleBlockSexp: SExp[] = [new Symbol("title_block")];

      if (this.titleBlock.title) {
        titleBlockSexp.push([new Symbol("title"), this.titleBlock.title]);
      }
      if (this.titleBlock.date) {
        titleBlockSexp.push([new Symbol("date"), this.titleBlock.date]);
      }
      if (this.titleBlock.rev) {
        titleBlockSexp.push([new Symbol("rev"), this.titleBlock.rev]);
      }
      if (this.titleBlock.company) {
        titleBlockSexp.push([new Symbol("company"), this.titleBlock.company]);
      }
      for (const [num, text] of this.titleBlock.comment) {
        titleBlockSexp.push([new Symbol("comment"), num, text]);
      }

      result.push(titleBlockSexp);
    }

    return result;
  }
}
```

### Hierarchy Manager (`src/core/managers/hierarchy.ts`)

Port from `kicad_sch_api/core/managers/hierarchy.py` (~662 lines). This is a complex manager.

```typescript
// src/core/managers/hierarchy.ts

export interface HierarchyNode {
  path: string;
  name: string;
  filename: string;
  schematic?: Schematic;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  depth: number;
}

export interface SignalPath {
  segments: Array<{
    sheet: string;
    netName: string;
    type: "wire" | "label" | "hierarchical_label" | "sheet_pin";
  }>;
}

export class HierarchyManager extends BaseManager {
  private hierarchyTree?: HierarchyNode;
  private loadedSheets: Map<string, Schematic> = new Map();

  /**
   * Build the complete hierarchy tree starting from the root schematic.
   */
  buildHierarchyTree(): HierarchyNode {
    const root: HierarchyNode = {
      path: "/",
      name: "Root",
      filename: this.schematic.fileIO.getFilePath() || "untitled.kicad_sch",
      schematic: this.schematic,
      children: [],
      depth: 0,
    };

    this.buildChildNodes(root);
    this.hierarchyTree = root;
    return root;
  }

  private buildChildNodes(node: HierarchyNode): void {
    if (!node.schematic) return;

    for (const sheet of node.schematic.sheets.all()) {
      const childPath = `${node.path}${sheet.uuid}/`;
      const filename = sheet.filename.value;

      let childSchematic: Schematic | undefined;
      if (this.loadedSheets.has(filename)) {
        childSchematic = this.loadedSheets.get(filename);
      } else {
        try {
          const fullPath = node.schematic.fileIO.resolveRelativePath(filename);
          childSchematic = Schematic.load(fullPath);
          this.loadedSheets.set(filename, childSchematic);
        } catch (e) {
          // Sheet file not found - continue without it
        }
      }

      const childNode: HierarchyNode = {
        path: childPath,
        name: sheet.name.value,
        filename,
        schematic: childSchematic,
        children: [],
        parent: node,
        depth: node.depth + 1,
      };

      node.children.push(childNode);
      this.buildChildNodes(childNode);
    }
  }

  /**
   * Find sheets that are reused (instantiated multiple times).
   */
  findReusedSheets(): Map<string, string[]> {
    const sheetUsage: Map<string, string[]> = new Map();

    const collectUsage = (node: HierarchyNode) => {
      const existing = sheetUsage.get(node.filename) || [];
      existing.push(node.path);
      sheetUsage.set(node.filename, existing);

      for (const child of node.children) {
        collectUsage(child);
      }
    };

    if (this.hierarchyTree) {
      collectUsage(this.hierarchyTree);
    }

    // Filter to only reused sheets
    const reused = new Map<string, string[]>();
    for (const [filename, paths] of sheetUsage) {
      if (paths.length > 1) {
        reused.set(filename, paths);
      }
    }
    return reused;
  }

  /**
   * Validate that all sheet pins have matching hierarchical labels.
   */
  validateSheetPins(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const validate = (node: HierarchyNode) => {
      if (!node.schematic || !node.parent?.schematic) {
        for (const child of node.children) {
          validate(child);
        }
        return;
      }

      // Find the sheet in the parent that references this node
      const parentSheet = node.parent.schematic.sheets.find(
        (s) => s.filename.value === node.filename
      );

      if (parentSheet) {
        // Check each sheet pin has a matching hierarchical label
        for (const pin of parentSheet.pins) {
          const matchingLabel = node.schematic.labels.find(
            (l) => "shape" in l && l.text === pin.name
          );

          if (!matchingLabel) {
            issues.push({
              type: "error",
              message: `Sheet pin "${pin.name}" has no matching hierarchical label in ${node.filename}`,
              location: { sheet: node.path, element: pin.uuid },
            });
          }
        }

        // Check each hierarchical label has a matching sheet pin
        const hierLabels = node.schematic.labels.getHierarchicalLabels();
        for (const label of hierLabels) {
          const matchingPin = parentSheet.pins.find(
            (p) => p.name === label.text
          );

          if (!matchingPin) {
            issues.push({
              type: "warning",
              message: `Hierarchical label "${label.text}" has no matching sheet pin`,
              location: { sheet: node.path, element: label.uuid },
            });
          }
        }
      }

      for (const child of node.children) {
        validate(child);
      }
    };

    if (this.hierarchyTree) {
      validate(this.hierarchyTree);
    }

    return issues;
  }

  /**
   * Trace a signal through the hierarchy.
   */
  traceSignalPath(signalName: string, startPath?: string): SignalPath {
    const path: SignalPath = { segments: [] };

    // Implementation traces the signal through hierarchical labels and sheet pins
    // This is complex and requires connectivity analysis at each level

    return path;
  }

  /**
   * Flatten the hierarchy into a single schematic.
   */
  flattenHierarchy(): Schematic {
    const flattened = Schematic.create("Flattened");

    const flatten = (node: HierarchyNode, prefix: string) => {
      if (!node.schematic) return;

      // Copy components with prefixed references
      for (const component of node.schematic.components.all()) {
        const newRef = prefix + component.reference;
        flattened.components.add({
          libId: component.libId,
          reference: newRef,
          value: component.value,
          position: component.position, // Would need offset for real implementation
          rotation: component.rotation,
          footprint: component.footprint,
        });
      }

      // Copy wires
      for (const wire of node.schematic.wires.all()) {
        flattened.wires.add({ points: wire.points });
      }

      // Recursively flatten children
      for (const child of node.children) {
        flatten(child, prefix + child.name + "_");
      }
    };

    if (this.hierarchyTree) {
      flatten(this.hierarchyTree, "");
    }

    return flattened;
  }

  /**
   * Generate a text visualization of the hierarchy.
   */
  visualizeHierarchy(): string {
    const lines: string[] = [];

    const visualize = (node: HierarchyNode, indent: string) => {
      const marker = node.children.length > 0 ? "├── " : "└── ";
      lines.push(`${indent}${marker}${node.name} (${node.filename})`);

      const childIndent = indent + (node.children.length > 0 ? "│   " : "    ");
      for (const child of node.children) {
        visualize(child, childIndent);
      }
    };

    if (this.hierarchyTree) {
      lines.push(this.hierarchyTree.name);
      for (const child of this.hierarchyTree.children) {
        visualize(child, "");
      }
    }

    return lines.join("\n");
  }

  getHierarchyTree(): HierarchyNode | undefined {
    return this.hierarchyTree;
  }

  getLoadedSheets(): Map<string, Schematic> {
    return this.loadedSheets;
  }
}
```

### Wire Manager (`src/core/managers/wire.ts`)

Port from `kicad_sch_api/core/managers/wire.py` (~410 lines).

```typescript
// src/core/managers/wire.ts

export interface WireRouteOptions {
  routingMode?: "direct" | "orthogonal" | "auto";
  avoidComponents?: boolean;
  cornerDirection?: "horizontal_first" | "vertical_first" | "auto";
}

export class WireManager extends BaseManager {
  /**
   * Add a wire between two component pins.
   */
  addWireBetweenPins(
    ref1: string,
    pin1: string,
    ref2: string,
    pin2: string,
    options?: WireRouteOptions
  ): Wire {
    const pos1 = this.schematic.getComponentPinPosition(ref1, pin1);
    const pos2 = this.schematic.getComponentPinPosition(ref2, pin2);

    if (!pos1 || !pos2) {
      throw new ConnectivityError(
        `Cannot find pin positions for ${ref1}.${pin1} or ${ref2}.${pin2}`
      );
    }

    return this.addWireBetweenPoints(pos1, pos2, options);
  }

  /**
   * Add a wire between two points with optional routing.
   */
  addWireBetweenPoints(
    from: Point,
    to: Point,
    options?: WireRouteOptions
  ): Wire {
    const mode = options?.routingMode || "auto";

    if (mode === "direct" || (mode === "auto" && this.isAligned(from, to))) {
      // Direct wire
      return this.schematic.wires.add({ start: from, end: to });
    }

    // Orthogonal routing
    const routing = createOrthogonalRouting(
      from,
      to,
      options?.cornerDirection === "horizontal_first"
        ? CornerDirection.HORIZONTAL_FIRST
        : options?.cornerDirection === "vertical_first"
        ? CornerDirection.VERTICAL_FIRST
        : CornerDirection.AUTO
    );

    if (routing.isDirectRoute) {
      return this.schematic.wires.add({ start: from, end: to });
    }

    // Create wire segments
    const points = [from];
    if (routing.corner) {
      points.push(routing.corner);
    }
    points.push(to);

    // Add junction at corner if needed
    if (routing.corner) {
      this.schematic.junctions.add({ position: routing.corner });
    }

    return this.schematic.wires.add({ points });
  }

  /**
   * Auto-route wires between pins with obstacle avoidance.
   */
  autoRoutePins(
    ref1: string,
    pin1: string,
    ref2: string,
    pin2: string,
    options?: WireRouteOptions & { avoidComponents?: boolean }
  ): Wire[] {
    const pos1 = this.schematic.getComponentPinPosition(ref1, pin1);
    const pos2 = this.schematic.getComponentPinPosition(ref2, pin2);

    if (!pos1 || !pos2) {
      throw new ConnectivityError(`Cannot find pin positions`);
    }

    if (!options?.avoidComponents) {
      return [this.addWireBetweenPoints(pos1, pos2, options)];
    }

    // Get component bounding boxes for obstacle avoidance
    const obstacles = this.schematic.components
      .all()
      .map((c) => getComponentBoundingBox(c, this.schematic.symbolCache))
      .filter(Boolean);

    // Use A* or similar pathfinding with obstacles
    // This is a simplified implementation
    const path = this.findPath(pos1, pos2, obstacles);

    const wires: Wire[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      wires.push(
        this.schematic.wires.add({ start: path[i], end: path[i + 1] })
      );
    }

    // Add junctions at intermediate points
    for (let i = 1; i < path.length - 1; i++) {
      this.schematic.junctions.add({ position: path[i] });
    }

    return wires;
  }

  private isAligned(p1: Point, p2: Point): boolean {
    return Math.abs(p1.x - p2.x) < 0.01 || Math.abs(p1.y - p2.y) < 0.01;
  }

  private findPath(from: Point, to: Point, obstacles: BoundingBox[]): Point[] {
    // Simplified pathfinding - real implementation would use A*
    // For now, just do orthogonal routing
    const routing = createOrthogonalRouting(from, to, CornerDirection.AUTO);

    if (routing.isDirectRoute) {
      return [from, to];
    }

    return routing.corner ? [from, routing.corner, to] : [from, to];
  }
}
```

### Format Sync Manager (`src/core/managers/format-sync.ts`)

Port from `kicad_sch_api/core/managers/format_sync.py` (~502 lines). This is critical for format preservation.

```typescript
// src/core/managers/format-sync.ts

export class FormatSyncManager extends BaseManager {
  private originalSexp?: SExp[];
  private elementOrder: string[] = [];
  private preservedElements: Map<string, SExp> = new Map();

  /**
   * Store the original S-expression for format preservation.
   */
  setOriginal(sexp: SExp[]): void {
    this.originalSexp = sexp;
    this.captureElementOrder(sexp);
    this.capturePreservedElements(sexp);
  }

  /**
   * Capture the order of elements in the original file.
   */
  private captureElementOrder(sexp: SExp[]): void {
    this.elementOrder = [];
    for (const item of sexp) {
      if (Array.isArray(item) && item[0] instanceof Symbol) {
        this.elementOrder.push(item[0].name);
      }
    }
  }

  /**
   * Capture elements that should be preserved exactly.
   */
  private capturePreservedElements(sexp: SExp[]): void {
    this.preservedElements.clear();
    for (const item of sexp) {
      if (Array.isArray(item) && item[0] instanceof Symbol) {
        const tag = item[0].name;
        // Preserve certain elements exactly
        if (
          ["lib_symbols", "sheet_instances", "symbol_instances"].includes(tag)
        ) {
          this.preservedElements.set(tag, item);
        }
      }
    }
  }

  /**
   * Get the original element order for formatting.
   */
  getElementOrder(): string[] {
    return this.elementOrder;
  }

  /**
   * Get a preserved element by tag name.
   */
  getPreservedElement(tag: string): SExp | undefined {
    return this.preservedElements.get(tag);
  }

  /**
   * Merge modified data with preserved formatting.
   */
  mergeWithOriginal(newSexp: SExp[]): SExp[] {
    if (!this.originalSexp) {
      return newSexp;
    }

    // Reorder elements to match original order
    const result: SExp[] = [newSexp[0]]; // Keep kicad_sch tag
    const newElements = new Map<string, SExp[]>();

    // Group new elements by tag
    for (let i = 1; i < newSexp.length; i++) {
      const item = newSexp[i];
      if (Array.isArray(item) && item[0] instanceof Symbol) {
        const tag = item[0].name;
        if (!newElements.has(tag)) {
          newElements.set(tag, []);
        }
        newElements.get(tag)!.push(item);
      }
    }

    // Add elements in original order
    const addedTags = new Set<string>();
    for (const tag of this.elementOrder) {
      if (newElements.has(tag) && !addedTags.has(tag)) {
        for (const elem of newElements.get(tag)!) {
          result.push(elem);
        }
        addedTags.add(tag);
      }
    }

    // Add any new elements that weren't in the original
    for (const [tag, elements] of newElements) {
      if (!addedTags.has(tag)) {
        for (const elem of elements) {
          result.push(elem);
        }
      }
    }

    return result;
  }
}
```

---

## Schematic Class

Port from `kicad_sch_api/core/schematic.py` (~2107 lines). This is the main entry point.

```typescript
// src/core/schematic.ts

export class Schematic {
  // Managers
  readonly fileIO: FileIOManager;
  readonly metadata: MetadataManager;
  readonly wireManager: WireManager;
  readonly sheetManager: SheetManager;
  readonly hierarchy: HierarchyManager;
  readonly formatSync: FormatSyncManager;
  readonly validationManager: ValidationManager;
  readonly textManager: TextElementsManager;
  readonly graphicsManager: GraphicsManager;

  // Collections
  readonly components: ComponentCollection;
  readonly wires: WireCollection;
  readonly buses: BusCollection;
  readonly busEntries: BusEntryCollection;
  readonly labels: LabelCollection;
  readonly junctions: JunctionCollection;
  readonly noConnects: NoConnectCollection;
  readonly sheets: SheetCollection;
  readonly texts: TextCollection;
  readonly textBoxes: TextBoxCollection;
  readonly rectangles: RectangleCollection;
  readonly images: ImageCollection;

  // Internal state
  private parser: SExpressionParser;
  private formatter: ExactFormatter;
  private libSymbols: Map<string, SymbolDefinition> = new Map();
  private symbolInstances: SExp[] = [];
  private sheetInstances: SExp[] = [];
  private modified: boolean = false;

  // Symbol cache reference
  symbolCache?: SymbolLibraryCache;

  private constructor() {
    this.parser = new SExpressionParser();
    this.formatter = new ExactFormatter();

    // Initialize managers
    this.fileIO = new FileIOManager(this);
    this.metadata = new MetadataManager(this);
    this.wireManager = new WireManager(this);
    this.sheetManager = new SheetManager(this);
    this.hierarchy = new HierarchyManager(this);
    this.formatSync = new FormatSyncManager(this);
    this.validationManager = new ValidationManager(this);
    this.textManager = new TextElementsManager(this);
    this.graphicsManager = new GraphicsManager(this);

    // Initialize collections
    this.components = new ComponentCollection(this);
    this.wires = new WireCollection();
    this.buses = new BusCollection();
    this.busEntries = new BusEntryCollection();
    this.labels = new LabelCollection();
    this.junctions = new JunctionCollection();
    this.noConnects = new NoConnectCollection();
    this.sheets = new SheetCollection();
    this.texts = new TextCollection();
    this.textBoxes = new TextBoxCollection();
    this.rectangles = new RectangleCollection();
    this.images = new ImageCollection();
  }

  // ============================================================
  // Static Factory Methods
  // ============================================================

  static load(filePath: string): Schematic {
    const schematic = new Schematic();
    const content = schematic.fileIO.load(filePath);
    schematic.parse(content);
    return schematic;
  }

  static create(name: string = "Untitled"): Schematic {
    const schematic = new Schematic();
    schematic.metadata.setTitle(name);
    return schematic;
  }

  static fromString(content: string): Schematic {
    const schematic = new Schematic();
    schematic.parse(content);
    return schematic;
  }

  // ============================================================
  // Parsing
  // ============================================================

  private parse(content: string): void {
    const sexp = this.parser.parse(content) as SExp[];

    if (
      !Array.isArray(sexp) ||
      !(sexp[0] instanceof Symbol) ||
      sexp[0].name !== "kicad_sch"
    ) {
      throw new ParseError("Invalid KiCAD schematic file");
    }

    // Store original for format preservation
    this.formatSync.setOriginal(sexp);

    // Parse metadata
    this.metadata.loadFromSexp(sexp);

    // Parse each element
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof Symbol)) continue;

      const tag = item[0].name;
      switch (tag) {
        case "lib_symbols":
          this.parseLibSymbols(item);
          break;
        case "symbol":
          this.parseSymbol(item);
          break;
        case "wire":
          this.parseWire(item);
          break;
        case "bus":
          this.parseBus(item);
          break;
        case "bus_entry":
          this.parseBusEntry(item);
          break;
        case "junction":
          this.parseJunction(item);
          break;
        case "no_connect":
          this.parseNoConnect(item);
          break;
        case "label":
          this.parseLabel(item);
          break;
        case "global_label":
          this.parseGlobalLabel(item);
          break;
        case "hierarchical_label":
          this.parseHierarchicalLabel(item);
          break;
        case "text":
          this.parseText(item);
          break;
        case "text_box":
          this.parseTextBox(item);
          break;
        case "rectangle":
          this.parseRectangle(item);
          break;
        case "sheet":
          this.parseSheet(item);
          break;
        case "sheet_instances":
          this.sheetInstances = item;
          break;
        case "symbol_instances":
          this.symbolInstances = item;
          break;
        case "image":
          this.parseImage(item);
          break;
      }
    }

    this.modified = false;
  }

  private parseLibSymbols(sexp: SExp[]): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof Symbol &&
        item[0].name === "symbol"
      ) {
        const symbolDef = this.parseSymbolDefinition(item);
        this.libSymbols.set(symbolDef.libId, symbolDef);
      }
    }
  }

  private parseSymbolDefinition(sexp: SExp[]): SymbolDefinition {
    // Parse symbol definition from lib_symbols
    // This is complex - see Python implementation
    const libId = sexp[1] as string;
    // ... full implementation
    return {
      libId,
      name: libId.split(":")[1] || libId,
      library: libId.split(":")[0] || "",
      // ... other fields
    } as SymbolDefinition;
  }

  private parseSymbol(sexp: SExp[]): void {
    // Parse placed symbol (component)
    // See Python kicad_sch_api/parsers/elements/symbol_parser.py (~796 lines)
    const symbol = {} as SchematicSymbol;
    // ... full implementation
    const component = new Component(symbol, this.components);
    this.components.add(component);
  }

  private parseWire(sexp: SExp[]): void {
    // Parse wire element
    const wire = {} as Wire;
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item)) continue;
      const tag = item[0] instanceof Symbol ? item[0].name : null;

      switch (tag) {
        case "pts":
          wire.points = this.parsePoints(item);
          break;
        case "stroke":
          // Parse stroke properties
          break;
        case "uuid":
          wire.uuid = item[1] as string;
          break;
      }
    }
    this.wires.add(wire);
  }

  private parsePoints(sexp: SExp[]): Point[] {
    const points: Point[] = [];
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof Symbol &&
        item[0].name === "xy"
      ) {
        points.push({ x: item[1] as number, y: item[2] as number });
      }
    }
    return points;
  }

  // ... implement other parse methods (parseJunction, parseLabel, etc.)

  // ============================================================
  // Formatting / Serialization
  // ============================================================

  format(): string {
    const sexp = this.toSexp();
    return this.formatter.format(sexp);
  }

  toSexp(): SExp[] {
    const result: SExp[] = [new Symbol("kicad_sch")];

    // Add metadata
    result.push(...this.metadata.toSexp());

    // Add lib_symbols
    result.push(this.libSymbolsToSexp());

    // Add all elements in correct order
    for (const component of this.components) {
      result.push(this.componentToSexp(component));
    }

    for (const wire of this.wires) {
      result.push(this.wireToSexp(wire));
    }

    for (const bus of this.buses) {
      result.push(this.busToSexp(bus));
    }

    for (const junction of this.junctions) {
      result.push(this.junctionToSexp(junction));
    }

    for (const noConnect of this.noConnects) {
      result.push(this.noConnectToSexp(noConnect));
    }

    for (const label of this.labels) {
      result.push(this.labelToSexp(label));
    }

    for (const text of this.texts) {
      result.push(this.textToSexp(text));
    }

    for (const textBox of this.textBoxes) {
      result.push(this.textBoxToSexp(textBox));
    }

    for (const rect of this.rectangles) {
      result.push(this.rectangleToSexp(rect));
    }

    for (const sheet of this.sheets) {
      result.push(this.sheetToSexp(sheet));
    }

    // Add instances
    if (this.sheetInstances.length > 0) {
      result.push(this.sheetInstances);
    }
    if (this.symbolInstances.length > 0) {
      result.push(this.symbolInstances);
    }

    // Merge with original for format preservation
    return this.formatSync.mergeWithOriginal(result);
  }

  // ... implement toSexp helper methods

  // ============================================================
  // File Operations
  // ============================================================

  save(filePath?: string): void {
    this.fileIO.save(filePath);
    this.modified = false;
  }

  // ============================================================
  // Convenience Properties
  // ============================================================

  get uuid(): string {
    return this.metadata.getUuid();
  }

  get title(): string | undefined {
    return this.metadata.getTitleBlock().title;
  }

  get titleBlock(): TitleBlock {
    return this.metadata.getTitleBlock();
  }

  get isModified(): boolean {
    return (
      this.modified ||
      this.components.isModified ||
      this.wires.isModified ||
      this.labels.isModified ||
      this.junctions.isModified
    );
  }

  markModified(): void {
    this.modified = true;
  }

  // ============================================================
  // Component Pin Position
  // ============================================================

  getComponentPinPosition(
    reference: string,
    pinNumber: string
  ): Point | undefined {
    const component = this.components.get(reference);
    if (!component) return undefined;

    // Get symbol definition
    const symbolDef =
      this.libSymbols.get(component.libId) ||
      this.symbolCache?.getSymbol(component.libId);

    if (!symbolDef) return undefined;

    // Find pin in symbol definition
    const unit = symbolDef.units.get(component.unit);
    if (!unit) return undefined;

    const pin = unit.pins.find((p) => p.number === pinNumber);
    if (!pin) return undefined;

    // Transform pin position from symbol space to schematic space
    return transformPinToSchematic(
      pin.position,
      component.position,
      component.rotation,
      component.mirror
    );
  }

  // ============================================================
  // Wire Routing (Delegated to WireManager)
  // ============================================================

  addWireBetweenPins(
    ref1: string,
    pin1: string,
    ref2: string,
    pin2: string,
    options?: WireRouteOptions
  ): Wire {
    return this.wireManager.addWireBetweenPins(ref1, pin1, ref2, pin2, options);
  }

  autoRoutePins(
    ref1: string,
    pin1: string,
    ref2: string,
    pin2: string,
    options?: WireRouteOptions
  ): Wire[] {
    return this.wireManager.autoRoutePins(ref1, pin1, ref2, pin2, options);
  }

  // ============================================================
  // Validation
  // ============================================================

  validate(): ValidationIssue[] {
    return this.validationManager.validate();
  }

  // ============================================================
  // Export
  // ============================================================

  exportToPython(
    outputPath: string,
    options?: {
      template?: "minimal" | "default" | "verbose" | "documented";
      includeHierarchy?: boolean;
      formatCode?: boolean;
      addComments?: boolean;
    }
  ): string {
    const generator = new PythonCodeGenerator(
      options?.template || "default",
      options?.formatCode !== false,
      options?.addComments !== false
    );
    return generator.generate(
      this,
      options?.includeHierarchy !== false,
      outputPath
    );
  }

  // ============================================================
  // Drawing Utilities
  // ============================================================

  drawBoundingBox(
    bbox: BoundingBox,
    strokeColor?: [number, number, number, number]
  ): void {
    this.rectangles.add({
      start: { x: bbox.minX, y: bbox.minY },
      end: { x: bbox.maxX, y: bbox.maxY },
      strokeColor: strokeColor || [255, 0, 0, 1],
    });
  }

  drawComponentBoundingBoxes(includeProperties: boolean = true): void {
    for (const component of this.components) {
      const bbox = getComponentBoundingBox(
        component,
        this.symbolCache,
        includeProperties
      );
      if (bbox) {
        this.drawBoundingBox(bbox);
      }
    }
  }
}
```

---

## Symbol Library Cache

Port from `kicad_sch_api/library/cache.py` (~1430 lines). This provides access to KiCAD's symbol libraries.

```typescript
// src/library/cache.ts

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

export interface LibraryStats {
  symbolCount: number;
  loadTime: number;
  lastAccessed: number;
}

export class SymbolLibraryCache {
  private symbolCache: Map<string, SymbolDefinition> = new Map();
  private libraryIndex: Map<string, string[]> = new Map(); // library name -> symbol names
  private libraryPaths: string[] = [];
  private libStats: Map<string, LibraryStats> = new Map();

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
      // macOS
      standardPaths.push(
        "/Applications/KiCad/KiCad.app/Contents/SharedSupport/symbols",
        join(homedir(), "Library/Application Support/kicad/8.0/symbols"),
        join(homedir(), "Library/Application Support/kicad/7.0/symbols")
      );
    } else if (platform === "win32") {
      // Windows
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
    // Check cache first
    if (this.symbolCache.has(libId)) {
      return this.symbolCache.get(libId);
    }

    // Parse lib_id
    const [libraryName, symbolName] = libId.split(":");
    if (!libraryName || !symbolName) {
      return undefined;
    }

    // Load library if not indexed
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
    const parser = new SExpressionParser();
    const sexp = parser.parse(content) as SExp[];

    if (
      !Array.isArray(sexp) ||
      !(sexp[0] instanceof Symbol) ||
      sexp[0].name !== "kicad_symbol_lib"
    ) {
      throw new LibraryError(`Invalid symbol library file`);
    }

    const symbols: SymbolDefinition[] = [];

    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof Symbol &&
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
    sexp: SExp[],
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

    // Parse symbol contents
    for (let i = 2; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof Symbol)) continue;

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
          this.parsePinNumbers(item, symbol);
          break;
        case "in_bom":
          symbol.inBom = item[1] === "yes";
          break;
        case "on_board":
          symbol.onBoard = item[1] === "yes";
          break;
        case "symbol":
          // Nested symbol = unit definition
          this.parseSymbolUnit(item, symbol);
          break;
      }
    }

    return symbol;
  }

  private parseSymbolProperty(sexp: SExp[], symbol: SymbolDefinition): void {
    const name = sexp[1] as string;
    const value = sexp[2] as string;

    // Extract standard properties
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

    // Store all properties
    symbol.properties.set(name, {
      name,
      value,
      position: { x: 0, y: 0 },
      rotation: 0,
      effects: {
        rotation: 0,
        fontSize: [1.27, 1.27],
        bold: false,
        italic: false,
        visible: true,
      },
      showName: false,
    });
  }

  private parsePinNames(sexp: SExp[], symbol: SymbolDefinition): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (Array.isArray(item) && item[0] instanceof Symbol) {
        if (item[0].name === "offset") {
          symbol.pinNames.offset = item[1] as number;
        }
      } else if (item instanceof Symbol && item.name === "hide") {
        symbol.pinNames.hide = true;
      }
    }
  }

  private parsePinNumbers(sexp: SExp[], symbol: SymbolDefinition): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (item instanceof Symbol && item.name === "hide") {
        symbol.pinNumbers.hide = true;
      }
    }
  }

  private parseSymbolUnit(sexp: SExp[], symbol: SymbolDefinition): void {
    // Parse unit name like "Device:R_0_1" -> unit 0, style 1
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

    // Parse unit contents
    for (let i = 2; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof Symbol)) continue;

      const tag = item[0].name;
      switch (tag) {
        case "pin":
          unit.pins.push(this.parsePin(item));
          break;
        case "rectangle":
        case "circle":
        case "arc":
        case "polyline":
        case "text":
          unit.graphics.push(this.parseGraphic(item, tag));
          break;
      }
    }

    symbol.unitCount = Math.max(symbol.unitCount, unitNumber + 1);
  }

  private parsePin(sexp: SExp[]): SymbolPin {
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
      nameEffects: {
        rotation: 0,
        fontSize: [1.27, 1.27],
        bold: false,
        italic: false,
        visible: true,
      },
      numberEffects: {
        rotation: 0,
        fontSize: [1.27, 1.27],
        bold: false,
        italic: false,
        visible: true,
      },
      hide: false,
      alternate: [],
    };

    for (let i = 3; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof Symbol)) continue;

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

  private parseGraphic(sexp: SExp[], type: string): SymbolGraphics {
    return {
      type: type as any,
      // ... parse specific graphic properties
    };
  }

  /**
   * Search for symbols by name or keywords.
   */
  searchSymbols(query: string, limit: number = 50): SymbolDefinition[] {
    const results: SymbolDefinition[] = [];
    const queryLower = query.toLowerCase();

    // Ensure all libraries are indexed
    for (const libName of this.getLibraryNames()) {
      if (!this.libraryIndex.has(libName)) {
        this.loadLibrary(libName);
      }
    }

    // Search through cached symbols
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

  /**
   * Get performance statistics.
   */
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

## Geometry Module

Port from `kicad_sch_api/geometry/`.

### Routing (`src/geometry/routing.ts`)

Port from `kicad_sch_api/geometry/routing.py` (~202 lines).

```typescript
// src/geometry/routing.ts

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
 * CRITICAL: Remember KiCAD Y-axis is INVERTED:
 * - Lower Y values = visually HIGHER (top of screen)
 * - Higher Y values = visually LOWER (bottom of screen)
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
    // Vertical alignment - direct route
    return {
      segments: [{ start: fromPos, end: toPos }],
      isDirectRoute: true,
    };
  }

  if (Math.abs(dy) < 0.01) {
    // Horizontal alignment - direct route
    return {
      segments: [{ start: fromPos, end: toPos }],
      isDirectRoute: true,
    };
  }

  // Need L-shaped routing
  let corner: Point;

  if (cornerDirection === CornerDirection.AUTO) {
    // Heuristic: prefer horizontal first if dx >= dy
    cornerDirection =
      Math.abs(dx) >= Math.abs(dy)
        ? CornerDirection.HORIZONTAL_FIRST
        : CornerDirection.VERTICAL_FIRST;
  }

  if (cornerDirection === CornerDirection.HORIZONTAL_FIRST) {
    // Route horizontally first, then vertically
    corner = { x: toPos.x, y: fromPos.y };
  } else {
    // Route vertically first, then horizontally
    corner = { x: fromPos.x, y: toPos.y };
  }

  // Snap corner to grid
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

/**
 * Validate a routing result for connectivity.
 */
export function validateRoutingResult(result: RoutingResult): boolean {
  if (result.segments.length === 0) return false;

  // Check segments are connected
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

### Symbol Bounding Box (`src/geometry/symbol-bbox.ts`)

Port from `kicad_sch_api/geometry/symbol_bbox.py` (~608 lines).

```typescript
// src/geometry/symbol-bbox.ts

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

export function boundingBoxContainsPoint(
  bbox: BoundingBox,
  point: Point
): boolean {
  return (
    point.x >= bbox.minX &&
    point.x <= bbox.maxX &&
    point.y >= bbox.minY &&
    point.y <= bbox.maxY
  );
}

export function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

// KiCAD default dimensions
const DEFAULT_TEXT_HEIGHT = 2.54; // 100 mils
const DEFAULT_PIN_LENGTH = 2.54; // 100 mils
const DEFAULT_PIN_NAME_OFFSET = 0.508; // 20 mils
const DEFAULT_PIN_NUMBER_SIZE = 1.27; // 50 mils
const DEFAULT_PIN_TEXT_WIDTH_RATIO = 2.0;

export class SymbolBoundingBoxCalculator {
  /**
   * Calculate accurate bounding box from SymbolDefinition.
   */
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

    // Process all units
    for (const unit of symbol.units.values()) {
      // Process graphics
      for (const graphic of unit.graphics) {
        const graphicBbox = this.getGraphicBounds(graphic);
        if (graphicBbox) {
          minX = Math.min(minX, graphicBbox.minX);
          minY = Math.min(minY, graphicBbox.minY);
          maxX = Math.max(maxX, graphicBbox.maxX);
          maxY = Math.max(maxY, graphicBbox.maxY);
        }
      }

      // Process pins
      for (const pin of unit.pins) {
        const pinBbox = this.getPinBounds(pin, symbol.pinNames.offset);
        minX = Math.min(minX, pinBbox.minX);
        minY = Math.min(minY, pinBbox.minY);
        maxX = Math.max(maxX, pinBbox.maxX);
        maxY = Math.max(maxY, pinBbox.maxY);
      }
    }

    // Add property space if requested
    if (includeProperties) {
      // Reference typically above symbol
      minY -= DEFAULT_TEXT_HEIGHT * 1.5;
      // Value typically below symbol
      maxY += DEFAULT_TEXT_HEIGHT * 1.5;
    }

    // Ensure valid bounds
    if (!isFinite(minX)) {
      return createBoundingBox(-2.54, -2.54, 2.54, 2.54);
    }

    return createBoundingBox(minX, minY, maxX, maxY);
  }

  private static getGraphicBounds(graphic: SymbolGraphics): BoundingBox | null {
    switch (graphic.type) {
      case "rectangle":
        // Rectangle has start and end points
        return createBoundingBox(
          Math.min((graphic as any).start.x, (graphic as any).end.x),
          Math.min((graphic as any).start.y, (graphic as any).end.y),
          Math.max((graphic as any).start.x, (graphic as any).end.x),
          Math.max((graphic as any).start.y, (graphic as any).end.y)
        );
      case "circle":
        const center = (graphic as any).center;
        const radius = (graphic as any).radius;
        return createBoundingBox(
          center.x - radius,
          center.y - radius,
          center.x + radius,
          center.y + radius
        );
      case "polyline":
        const points = (graphic as any).points as Point[];
        if (points.length === 0) return null;
        let minX = points[0].x,
          minY = points[0].y;
        let maxX = points[0].x,
          maxY = points[0].y;
        for (const p of points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        return createBoundingBox(minX, minY, maxX, maxY);
      default:
        return null;
    }
  }

  private static getPinBounds(pin: SymbolPin, nameOffset: number): BoundingBox {
    const pos = pin.position;
    const length = pin.length;
    const rotation = pin.rotation;

    // Calculate pin endpoint based on rotation
    let endX = pos.x;
    let endY = pos.y;

    switch (rotation) {
      case 0: // Right
        endX = pos.x + length;
        break;
      case 90: // Up
        endY = pos.y + length;
        break;
      case 180: // Left
        endX = pos.x - length;
        break;
      case 270: // Down
        endY = pos.y - length;
        break;
    }

    // Calculate text extent
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
  // Get symbol definition
  const symbolDef = symbolCache?.getSymbol(component.libId);
  if (!symbolDef) return null;

  // Get symbol bounding box in symbol space
  const symbolBbox = SymbolBoundingBoxCalculator.calculateBoundingBox(
    symbolDef,
    includeProperties
  );

  // Transform to schematic space
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
  // Get corners
  const corners: Point[] = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];

  // Transform each corner
  const transformed = corners.map((corner) => {
    // Negate Y for symbol-to-schematic transformation
    let x = corner.x;
    let y = -corner.y; // CRITICAL: Y-negation

    // Apply mirror
    if (mirror === "x") x = -x;
    if (mirror === "y") y = -y;

    // Apply rotation
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotX = x * cos - y * sin;
    const rotY = x * sin + y * cos;

    // Translate
    return {
      x: position.x + rotX,
      y: position.y + rotY,
    };
  });

  // Find new bounds
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

### Font Metrics (`src/geometry/font-metrics.ts`)

```typescript
// src/geometry/font-metrics.ts

export const DEFAULT_TEXT_HEIGHT = 2.54; // 100 mils
export const DEFAULT_PIN_LENGTH = 2.54; // 100 mils
export const DEFAULT_PIN_NAME_OFFSET = 0.508; // 20 mils
export const DEFAULT_PIN_NUMBER_SIZE = 1.27; // 50 mils
export const DEFAULT_PIN_TEXT_WIDTH_RATIO = 2.0;
```

---

## Validation / ERC Module

Port from `kicad_sch_api/validation/`.

### ERC Models (`src/validation/erc-models.ts`)

```typescript
// src/validation/erc-models.ts

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
    position?: Point;
  };
  details?: Record<string, unknown>;
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
  checkMissingPowerPins: boolean;
  checkOffGridPins: boolean;
  treatWarningsAsErrors: boolean;
}

export const DEFAULT_ERC_CONFIG: ERCConfig = {
  checkPinConflicts: true,
  checkUnconnectedPins: true,
  checkDuplicateReferences: true,
  checkMissingPowerPins: true,
  checkOffGridPins: true,
  treatWarningsAsErrors: false,
};
```

### Pin Conflict Matrix (`src/validation/pin-matrix.ts`)

Port from `kicad_sch_api/validation/pin_matrix.py` (~242 lines).

```typescript
// src/validation/pin-matrix.ts

export enum PinSeverity {
  OK = "ok",
  WARNING = "warning",
  ERROR = "error",
}

export class PinConflictMatrix {
  private matrix: Map<string, Map<string, PinSeverity>> = new Map();

  constructor() {
    this.initializeDefaultMatrix();
  }

  private initializeDefaultMatrix(): void {
    // Define pin type conflicts
    // Based on KiCAD's ERC matrix
    const types = Object.values(PinType);

    for (const type1 of types) {
      this.matrix.set(type1, new Map());
      for (const type2 of types) {
        this.matrix.get(type1)!.set(type2, PinSeverity.OK);
      }
    }

    // Set conflicts
    // Output to Output = Error
    this.setConflict(PinType.OUTPUT, PinType.OUTPUT, PinSeverity.ERROR);

    // Power Out to Power Out = Error
    this.setConflict(PinType.POWER_OUT, PinType.POWER_OUT, PinSeverity.ERROR);

    // Output to Power Out = Error
    this.setConflict(PinType.OUTPUT, PinType.POWER_OUT, PinSeverity.ERROR);

    // Input to Input = Warning (no driver)
    this.setConflict(PinType.INPUT, PinType.INPUT, PinSeverity.WARNING);

    // Unconnected = Warning
    this.setConflict(
      PinType.UNSPECIFIED,
      PinType.UNSPECIFIED,
      PinSeverity.WARNING
    );
  }

  private setConflict(
    type1: PinType,
    type2: PinType,
    severity: PinSeverity
  ): void {
    this.matrix.get(type1)?.set(type2, severity);
    this.matrix.get(type2)?.set(type1, severity); // Symmetric
  }

  checkConflict(type1: PinType, type2: PinType): PinSeverity {
    return this.matrix.get(type1)?.get(type2) || PinSeverity.OK;
  }
}
```

### Electrical Rules Checker (`src/validation/erc.ts`)

Port from `kicad_sch_api/validation/erc.py` (~167 lines).

```typescript
// src/validation/erc.ts

export class ElectricalRulesChecker {
  private schematic: Schematic;
  private config: ERCConfig;
  private pinMatrix: PinConflictMatrix;

  constructor(schematic: Schematic, config?: Partial<ERCConfig>) {
    this.schematic = schematic;
    this.config = { ...DEFAULT_ERC_CONFIG, ...config };
    this.pinMatrix = new PinConflictMatrix();
  }

  check(): ERCResult {
    const violations: ERCViolation[] = [];

    if (this.config.checkDuplicateReferences) {
      violations.push(...this.checkDuplicateReferences());
    }

    if (this.config.checkPinConflicts) {
      violations.push(...this.checkPinConflicts());
    }

    if (this.config.checkUnconnectedPins) {
      violations.push(...this.checkUnconnectedPins());
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
    const seen = new Map<string, Component>();

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
        seen.set(ref, component);
      }
    }

    return violations;
  }

  private checkPinConflicts(): ERCViolation[] {
    // Analyze connectivity and check for pin type conflicts
    const violations: ERCViolation[] = [];
    // ... implementation using connectivity analysis
    return violations;
  }

  private checkUnconnectedPins(): ERCViolation[] {
    const violations: ERCViolation[] = [];
    // ... check for floating pins without no-connect markers
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

## BOM Module

Port from `kicad_sch_api/bom/`.

### BOM Auditor (`src/bom/auditor.ts`)

Port from `kicad_sch_api/bom/auditor.py` (~297 lines).

```typescript
// src/bom/auditor.ts

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
  /**
   * Audit a single schematic for missing properties.
   */
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

  /**
   * Audit all schematics in a directory.
   */
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
    // ... implementation using fs.readdirSync
    return files;
  }

  /**
   * Generate CSV report of issues.
   */
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

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    writeFileSync(outputPath, csv);
  }

  /**
   * Bulk update properties based on match criteria.
   */
  bulkUpdateProperties(
    schematicPath: string,
    matcher: PropertyMatcher,
    updates: Record<string, string>
  ): number {
    const sch = Schematic.load(schematicPath);
    let count = 0;

    for (const component of sch.components) {
      if (matcher.matches(component)) {
        for (const [name, value] of Object.entries(updates)) {
          component.setProperty(name, value);
        }
        count++;
      }
    }

    if (count > 0) {
      sch.save();
    }

    return count;
  }
}
```

### Property Matcher (`src/bom/matcher.ts`)

```typescript
// src/bom/matcher.ts

export interface MatchCriteria {
  libId?: string | RegExp;
  reference?: string | RegExp;
  value?: string | RegExp;
  footprint?: string | RegExp;
  property?: { name: string; value: string | RegExp };
}

export class PropertyMatcher {
  private criteria: MatchCriteria;

  constructor(criteria: MatchCriteria) {
    this.criteria = criteria;
  }

  matches(component: Component): boolean {
    if (this.criteria.libId) {
      if (!this.matchValue(component.libId, this.criteria.libId)) return false;
    }
    if (this.criteria.reference) {
      if (!this.matchValue(component.reference, this.criteria.reference))
        return false;
    }
    if (this.criteria.value) {
      if (!this.matchValue(component.value, this.criteria.value)) return false;
    }
    if (this.criteria.footprint) {
      if (!this.matchValue(component.footprint || "", this.criteria.footprint))
        return false;
    }
    if (this.criteria.property) {
      const propValue = component.getProperty(this.criteria.property.name);
      if (
        !propValue ||
        !this.matchValue(propValue, this.criteria.property.value)
      )
        return false;
    }
    return true;
  }

  private matchValue(value: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(value);
    }
    return value === pattern || value.includes(pattern);
  }
}
```

---

## Discovery Module

Port from `kicad_sch_api/discovery/`.

### Search Index (`src/discovery/search-index.ts`)

Port from `kicad_sch_api/discovery/search_index.py` (~456 lines).

```typescript
// src/discovery/search-index.ts

import Database from "better-sqlite3"; // or similar SQLite library
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

export class ComponentSearchIndex {
  private db: Database.Database;
  private dbPath: string;

  constructor(cacheDir?: string) {
    const dir = cacheDir || join(homedir(), ".cache", "kicad-sch-ts");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.dbPath = join(dir, "search_index.db");
    this.db = new Database(this.dbPath);
    this.initDatabase();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS components (
        lib_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        library TEXT NOT NULL,
        description TEXT DEFAULT '',
        keywords TEXT DEFAULT '',
        reference_prefix TEXT DEFAULT 'U',
        pin_count INTEGER DEFAULT 0,
        category TEXT DEFAULT '',
        last_updated REAL DEFAULT 0
      )
    `);

    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_name ON components(name COLLATE NOCASE)`
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_description ON components(description COLLATE NOCASE)`
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_library ON components(library)`
    );

    // Full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS components_fts 
      USING fts5(lib_id, name, description, keywords, content=components)
    `);
  }

  /**
   * Rebuild the search index from the symbol cache.
   */
  rebuildIndex(
    progressCallback?: (current: number, total: number) => void
  ): number {
    const cache = getSymbolCache();
    const libraries = cache.getLibraryNames();
    let count = 0;

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO components 
      (lib_id, name, library, description, keywords, reference_prefix, pin_count, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < libraries.length; i++) {
        const libName = libraries[i];
        const symbols = cache.getLibrarySymbols(libName);

        for (const symbol of symbols) {
          const pinCount = Array.from(symbol.units.values()).reduce(
            (sum, unit) => sum + unit.pins.length,
            0
          );

          insert.run(
            symbol.libId,
            symbol.name,
            symbol.library,
            symbol.description,
            symbol.keywords,
            symbol.referencePrefix,
            pinCount,
            Date.now()
          );
          count++;
        }

        if (progressCallback) {
          progressCallback(i + 1, libraries.length);
        }
      }
    });

    transaction();

    // Rebuild FTS index
    this.db.exec(
      `INSERT INTO components_fts(components_fts) VALUES('rebuild')`
    );

    return count;
  }

  /**
   * Search for components.
   */
  search(query: string, limit: number = 50): SymbolDefinition[] {
    const results = this.db
      .prepare(
        `
      SELECT lib_id FROM components_fts 
      WHERE components_fts MATCH ? 
      LIMIT ?
    `
      )
      .all(query, limit) as Array<{ lib_id: string }>;

    const cache = getSymbolCache();
    return results
      .map((r) => cache.getSymbol(r.lib_id))
      .filter(Boolean) as SymbolDefinition[];
  }

  /**
   * Search by category or library.
   */
  searchByLibrary(library: string, limit: number = 100): SymbolDefinition[] {
    const results = this.db
      .prepare(
        `
      SELECT lib_id FROM components WHERE library = ? LIMIT ?
    `
      )
      .all(library, limit) as Array<{ lib_id: string }>;

    const cache = getSymbolCache();
    return results
      .map((r) => cache.getSymbol(r.lib_id))
      .filter(Boolean) as SymbolDefinition[];
  }
}

let globalIndex: ComponentSearchIndex | undefined;

export function getSearchIndex(): ComponentSearchIndex {
  if (!globalIndex) {
    globalIndex = new ComponentSearchIndex();
  }
  return globalIndex;
}
```

---

## Exporters Module

Port from `kicad_sch_api/exporters/`.

### Python Code Generator (`src/exporters/python-generator.ts`)

Port from `kicad_sch_api/exporters/python_generator.py` (~607 lines).

```typescript
// src/exporters/python-generator.ts

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

    // Header
    lines.push("#!/usr/bin/env python3");
    lines.push('"""');
    lines.push(
      `Generated from: ${schematic.fileIO.getFilePath() || "unknown"}`
    );
    lines.push(`Generated at: ${new Date().toISOString()}`);
    lines.push('"""');
    lines.push("");
    lines.push("import kicad_sch_api as ksa");
    lines.push("");

    // Create schematic
    const title = schematic.title || "Untitled";
    lines.push(`# Create schematic`);
    lines.push(`sch = ksa.create_schematic("${this.escapeString(title)}")`);
    lines.push("");

    // Add components
    if (schematic.components.length > 0) {
      lines.push("# Add components");
      for (const component of schematic.components) {
        lines.push(this.generateComponentCode(component));
      }
      lines.push("");
    }

    // Add wires
    if (schematic.wires.length > 0) {
      lines.push("# Add wires");
      for (const wire of schematic.wires) {
        lines.push(this.generateWireCode(wire));
      }
      lines.push("");
    }

    // Add labels
    if (schematic.labels.length > 0) {
      lines.push("# Add labels");
      for (const label of schematic.labels) {
        lines.push(this.generateLabelCode(label));
      }
      lines.push("");
    }

    // Add junctions
    if (schematic.junctions.length > 0) {
      lines.push("# Add junctions");
      for (const junction of schematic.junctions) {
        lines.push(
          `sch.junctions.add(position=(${junction.position.x}, ${junction.position.y}))`
        );
      }
      lines.push("");
    }

    // Save
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
    if ("shape" in label && "properties" in label) {
      // Global label
      return `sch.labels.add(text="${this.escapeString(
        label.text
      )}", position=(${pos.x}, ${pos.y}), type="global", shape="${
        label.shape
      }")`;
    } else if ("shape" in label) {
      // Hierarchical label
      return `sch.labels.add(text="${this.escapeString(
        label.text
      )}", position=(${pos.x}, ${pos.y}), type="hierarchical", shape="${
        label.shape
      }")`;
    } else {
      // Local label
      return `sch.labels.add(text="${this.escapeString(
        label.text
      )}", position=(${pos.x}, ${pos.y})")`;
    }
  }

  private escapeString(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  }
}
```

---

## CLI Adapter

Port from `kicad_sch_api/cli/`. The CLI provides 9+ commands.

### CLI Entry Point (`src/adapters/cli/index.ts`)

```typescript
// src/adapters/cli/index.ts

import { Command } from "commander";
import { bomCommand } from "./bom";
import { bomManageCommand } from "./bom-manage";
import { ercCommand } from "./erc";
import { exportDocsCommand } from "./export-docs";
import { findLibrariesCommand } from "./find-libraries";
import { kicadToPythonCommand } from "./kicad-to-python";
import { netlistCommand } from "./netlist";
import { setupClaudeCommand } from "./setup-claude";
import { demoCommand } from "./demo";

const program = new Command();

program
  .name("kicad-sch")
  .description("KiCAD Schematic API - Command Line Interface")
  .version("1.0.0");

// Register all commands
program.addCommand(bomCommand);
program.addCommand(bomManageCommand);
program.addCommand(ercCommand);
program.addCommand(exportDocsCommand);
program.addCommand(findLibrariesCommand);
program.addCommand(kicadToPythonCommand);
program.addCommand(netlistCommand);
program.addCommand(setupClaudeCommand);
program.addCommand(demoCommand);

// Test command
program
  .command("test")
  .description("Test that the library is working correctly")
  .action(() => {
    console.log("🧪 Testing KiCAD Schematic API Library...");
    try {
      const sch = Schematic.create("test");
      console.log("✅ Can create schematic");

      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });
      console.log("✅ Can add components");

      console.log("🎉 All tests passed!");
    } catch (e) {
      console.error("❌ Test failed:", e);
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description("Show current installation status")
  .action(() => {
    console.log("📊 KiCAD Schematic API Library Status");
    console.log("=".repeat(40));

    const cache = getSymbolCache();
    const stats = cache.getPerformanceStats();
    console.log(`✅ Library installed: v1.0.0`);
    console.log(
      `✅ KiCAD libraries: ${stats.totalLibrariesLoaded} libraries, ${stats.totalSymbolsCached} symbols`
    );
  });

export { program };

// CLI entry point
if (require.main === module) {
  program.parse();
}
```

### BOM Command (`src/adapters/cli/bom.ts`)

```typescript
// src/adapters/cli/bom.ts

import { Command } from "commander";

export const bomCommand = new Command("bom")
  .description("Extract Bill of Materials from schematic")
  .argument("<schematic>", "Path to .kicad_sch file")
  .option("-o, --output <file>", "Output CSV file")
  .option("-f, --format <format>", "Output format (csv, json, markdown)", "csv")
  .option("--group-by <field>", "Group components by field", "value")
  .option("--exclude-dnp", "Exclude DNP components")
  .action((schematic, options) => {
    const sch = Schematic.load(schematic);

    const components = options.excludeDnp
      ? sch.components.filter((c) => c.inBom)
      : sch.components.all();

    // Group components
    const groups = new Map<string, Component[]>();
    for (const comp of components) {
      const key = comp.getProperty(options.groupBy) || comp.value;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(comp);
    }

    // Generate output
    if (options.format === "csv") {
      const lines = ["Reference,Value,Footprint,Quantity"];
      for (const [value, comps] of groups) {
        const refs = comps
          .map((c) => c.reference)
          .sort()
          .join(", ");
        const footprint = comps[0].footprint || "";
        lines.push(`"${refs}","${value}","${footprint}",${comps.length}`);
      }

      if (options.output) {
        writeFileSync(options.output, lines.join("\n"));
        console.log(`✅ BOM written to ${options.output}`);
      } else {
        console.log(lines.join("\n"));
      }
    } else if (options.format === "json") {
      const bom = Array.from(groups.entries()).map(([value, comps]) => ({
        value,
        references: comps.map((c) => c.reference).sort(),
        footprint: comps[0].footprint,
        quantity: comps.length,
      }));

      const json = JSON.stringify(bom, null, 2);
      if (options.output) {
        writeFileSync(options.output, json);
        console.log(`✅ BOM written to ${options.output}`);
      } else {
        console.log(json);
      }
    }
  });
```

### ERC Command (`src/adapters/cli/erc.ts`)

```typescript
// src/adapters/cli/erc.ts

import { Command } from "commander";

export const ercCommand = new Command("erc")
  .description("Run Electrical Rules Check on schematic")
  .argument("<schematic>", "Path to .kicad_sch file")
  .option("--strict", "Treat warnings as errors")
  .option("--json", "Output results as JSON")
  .action((schematic, options) => {
    const sch = Schematic.load(schematic);
    const checker = new ElectricalRulesChecker(sch, {
      treatWarningsAsErrors: options.strict,
    });

    const result = checker.check();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n📋 ERC Results for ${schematic}`);
      console.log("=".repeat(50));

      for (const violation of result.violations) {
        const icon = violation.severity === ERCSeverity.ERROR ? "❌" : "⚠️";
        console.log(`${icon} [${violation.code}] ${violation.message}`);
        if (violation.location?.element) {
          console.log(`   Element: ${violation.location.element}`);
        }
      }

      console.log("");
      console.log(`Errors: ${result.errorCount}`);
      console.log(`Warnings: ${result.warningCount}`);
      console.log(`Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
    }

    process.exit(result.passed ? 0 : 1);
  });
```

### KiCAD to Python Command (`src/adapters/cli/kicad-to-python.ts`)

```typescript
// src/adapters/cli/kicad-to-python.ts

import { Command } from "commander";

export const kicadToPythonCommand = new Command("kicad-to-python")
  .description("Convert KiCAD schematic to Python code")
  .argument("<input>", "Input .kicad_sch file")
  .argument("<output>", "Output .py file")
  .option(
    "-t, --template <template>",
    "Code template (minimal, default, verbose, documented)",
    "default"
  )
  .option("--no-format", "Skip code formatting")
  .option("--no-comments", "Skip adding comments")
  .action((input, output, options) => {
    const sch = Schematic.load(input);

    const generator = new PythonCodeGenerator(
      options.template,
      options.format !== false,
      options.comments !== false
    );

    const code = generator.generate(sch, true, output);
    writeFileSync(output, code);

    console.log(`✅ Python code written to ${output}`);
  });
```

### Find Libraries Command (`src/adapters/cli/find-libraries.ts`)

```typescript
// src/adapters/cli/find-libraries.ts

import { Command } from "commander";

export const findLibrariesCommand = new Command("find-libraries")
  .description("Find and list KiCAD symbol libraries")
  .option("--json", "Output as JSON")
  .option("--search <query>", "Search for symbols")
  .action((options) => {
    const cache = getSymbolCache();

    if (options.search) {
      const results = cache.searchSymbols(options.search, 20);

      if (options.json) {
        console.log(
          JSON.stringify(
            results.map((s) => ({
              libId: s.libId,
              description: s.description,
              keywords: s.keywords,
            })),
            null,
            2
          )
        );
      } else {
        console.log(`\n🔍 Search results for "${options.search}":`);
        for (const symbol of results) {
          console.log(`  ${symbol.libId}`);
          if (symbol.description) {
            console.log(`    ${symbol.description}`);
          }
        }
      }
    } else {
      const libraries = cache.getLibraryNames();

      if (options.json) {
        console.log(JSON.stringify(libraries, null, 2));
      } else {
        console.log(`\n📚 Found ${libraries.length} symbol libraries:`);
        for (const lib of libraries) {
          console.log(`  ${lib}`);
        }
      }
    }
  });
```

### Demo Command (`src/adapters/cli/demo.ts`)

```typescript
// src/adapters/cli/demo.ts

import { Command } from "commander";

export const demoCommand = new Command("demo")
  .description("Create a demo schematic")
  .option("-o, --output <file>", "Output file", "demo_circuit.kicad_sch")
  .action((options) => {
    console.log("🎨 Creating demo schematic...");

    const sch = Schematic.create("Demo_Circuit");

    // Add components
    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });

    sch.components.add({
      libId: "Device:C",
      reference: "C1",
      value: "100nF",
      position: { x: 150, y: 100 },
    });

    sch.components.add({
      libId: "Device:LED",
      reference: "D1",
      value: "LED",
      position: { x: 200, y: 100 },
    });

    // Add wires
    sch.wires.add({
      start: { x: 100, y: 100 },
      end: { x: 150, y: 100 },
    });

    sch.wires.add({
      start: { x: 150, y: 100 },
      end: { x: 200, y: 100 },
    });

    // Add labels
    sch.labels.add({
      text: "VCC",
      position: { x: 100, y: 90 },
    });

    sch.labels.add({
      text: "GND",
      position: { x: 200, y: 110 },
    });

    // Save
    sch.save(options.output);
    console.log(`✅ Demo schematic created: ${options.output}`);
  });
```

### Setup Claude Command (`src/adapters/cli/setup-claude.ts`)

```typescript
// src/adapters/cli/setup-claude.ts

import { Command } from "commander";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export const setupClaudeCommand = new Command("setup-claude")
  .description("Configure Claude Desktop for MCP integration")
  .option("--dry-run", "Show what would be done without making changes")
  .action((options) => {
    const configDir = join(homedir(), ".config", "claude");
    const configPath = join(configDir, "claude_desktop_config.json");

    const mcpConfig = {
      mcpServers: {
        "kicad-sch": {
          command: "npx",
          args: ["kicad-sch-ts", "mcp"],
        },
      },
    };

    if (options.dryRun) {
      console.log("Would write to:", configPath);
      console.log(JSON.stringify(mcpConfig, null, 2));
      return;
    }

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    let existingConfig: any = {};
    if (existsSync(configPath)) {
      existingConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    }

    existingConfig.mcpServers = {
      ...existingConfig.mcpServers,
      ...mcpConfig.mcpServers,
    };

    writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));
    console.log(`✅ Claude Desktop configured for MCP integration`);
    console.log(`   Config file: ${configPath}`);
  });
```

---

## MCP Server Adapter

Port from `kicad_sch_api/mcp_server/`. The MCP server provides 15+ tools for AI assistants.

### MCP Server (`src/adapters/mcp/server.ts`)

```typescript
// src/adapters/mcp/server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { consolidatedTools } from "./tools/consolidated";
import { componentTools } from "./tools/component";
import { connectivityTools } from "./tools/connectivity";
import { pinDiscoveryTools } from "./tools/pin-discovery";

// Global schematic state
let currentSchematic: Schematic | undefined;

export function getCurrentSchematic(): Schematic | undefined {
  return currentSchematic;
}

export function setCurrentSchematic(sch: Schematic): void {
  currentSchematic = sch;
}

export async function startMcpServer(): Promise<void> {
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

  // Register all tools
  const allTools = [
    ...consolidatedTools,
    ...componentTools,
    ...connectivityTools,
    ...pinDiscoveryTools,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = allTools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Unknown tool: ${request.params.name}` },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(request.params.arguments || {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### Consolidated Tools (`src/adapters/mcp/tools/consolidated.ts`)

Port from `kicad_sch_api/mcp_server/tools/consolidated_tools.py` (~1480 lines).

```typescript
// src/adapters/mcp/tools/consolidated.ts

import { getCurrentSchematic, setCurrentSchematic } from "../server";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: any) => Promise<any>;
}

// 1. MANAGE SCHEMATIC
const manageSchematic: ToolDefinition = {
  name: "manage_schematic",
  description: "Manage schematic project (create, read, save, load)",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "read", "save", "load"],
        description: "Operation to perform",
      },
      name: {
        type: "string",
        description: "Project name (required for create)",
      },
      file_path: {
        type: "string",
        description: "File path (required for load/save)",
      },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const { action, name, file_path } = args;

    switch (action) {
      case "create":
        if (!name) {
          return {
            success: false,
            error: "INVALID_PARAMS",
            message: "name required for create",
          };
        }
        const newSch = Schematic.create(name);
        setCurrentSchematic(newSch);
        return {
          success: true,
          project_name: name,
          uuid: newSch.uuid,
          message: `Created schematic: ${name}`,
        };

      case "read":
        const sch = getCurrentSchematic();
        if (!sch) {
          return {
            success: false,
            error: "NO_SCHEMATIC_LOADED",
            message: "No schematic loaded",
          };
        }
        return {
          success: true,
          project_name: sch.title,
          uuid: sch.uuid,
          component_count: sch.components.length,
          wire_count: sch.wires.length,
          label_count: sch.labels.length,
        };

      case "load":
        if (!file_path) {
          return {
            success: false,
            error: "INVALID_PARAMS",
            message: "file_path required for load",
          };
        }
        const loadedSch = Schematic.load(file_path);
        setCurrentSchematic(loadedSch);
        return {
          success: true,
          project_name: loadedSch.title,
          uuid: loadedSch.uuid,
          component_count: loadedSch.components.length,
          message: `Loaded: ${file_path}`,
        };

      case "save":
        const currentSch = getCurrentSchematic();
        if (!currentSch) {
          return {
            success: false,
            error: "NO_SCHEMATIC_LOADED",
            message: "No schematic loaded",
          };
        }
        currentSch.save(file_path);
        return {
          success: true,
          message: `Saved to: ${file_path || currentSch.fileIO.getFilePath()}`,
        };

      default:
        return {
          success: false,
          error: "INVALID_ACTION",
          message: `Unknown action: ${action}`,
        };
    }
  },
};

// 2. MANAGE COMPONENT
const manageComponent: ToolDefinition = {
  name: "manage_component",
  description: "CRUD operations for schematic components",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "read", "update", "delete", "list"],
        description: "Operation to perform",
      },
      lib_id: {
        type: "string",
        description: "Symbol library ID (e.g., Device:R)",
      },
      reference: {
        type: "string",
        description: "Reference designator (e.g., R1)",
      },
      value: { type: "string", description: "Component value" },
      position_x: { type: "number", description: "X position in mm" },
      position_y: { type: "number", description: "Y position in mm" },
      rotation: { type: "number", description: "Rotation in degrees" },
      footprint: { type: "string", description: "Footprint name" },
      properties: { type: "object", description: "Additional properties" },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const {
      action,
      lib_id,
      reference,
      value,
      position_x,
      position_y,
      rotation,
      footprint,
      properties,
    } = args;

    switch (action) {
      case "create":
        if (
          !lib_id ||
          !reference ||
          !value ||
          position_x === undefined ||
          position_y === undefined
        ) {
          return {
            success: false,
            error: "INVALID_PARAMS",
            message: "lib_id, reference, value, position required",
          };
        }
        const component = sch.components.add({
          libId: lib_id,
          reference,
          value,
          position: { x: position_x, y: position_y },
          rotation: rotation || 0,
          footprint,
          properties,
        });
        return {
          success: true,
          reference: component.reference,
          uuid: component.uuid,
          message: `Created component ${reference}`,
        };

      case "read":
        if (!reference) {
          return {
            success: false,
            error: "INVALID_PARAMS",
            message: "reference required",
          };
        }
        const comp = sch.components.get(reference);
        if (!comp) {
          return {
            success: false,
            error: "NOT_FOUND",
            message: `Component ${reference} not found`,
          };
        }
        return {
          success: true,
          reference: comp.reference,
          lib_id: comp.libId,
          value: comp.value,
          position: comp.position,
          rotation: comp.rotation,
          footprint: comp.footprint,
          properties: comp.properties,
        };

      case "update":
        if (!reference) {
          return {
            success: false,
            error: "INVALID_PARAMS",
            message: "reference required",
          };
        }
        const updateComp = sch.components.get(reference);
        if (!updateComp) {
          return { success: false, error: "NOT_FOUND" };
        }
        if (value) updateComp.value = value;
        if (footprint) updateComp.footprint = footprint;
        if (properties) {
          for (const [name, val] of Object.entries(properties)) {
            updateComp.setProperty(name, val as string);
          }
        }
        return { success: true, message: `Updated ${reference}` };

      case "delete":
        if (!reference) {
          return { success: false, error: "INVALID_PARAMS" };
        }
        const deleted = sch.components.remove(reference);
        return {
          success: deleted,
          message: deleted ? `Deleted ${reference}` : "Not found",
        };

      case "list":
        return {
          success: true,
          components: sch.components.all().map((c) => ({
            reference: c.reference,
            lib_id: c.libId,
            value: c.value,
            position: c.position,
          })),
        };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

// 3. MANAGE WIRE
const manageWire: ToolDefinition = {
  name: "manage_wire",
  description: "CRUD operations for wires",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "read", "delete", "list", "route_pins"],
        description: "Operation to perform",
      },
      start_x: { type: "number" },
      start_y: { type: "number" },
      end_x: { type: "number" },
      end_y: { type: "number" },
      uuid: { type: "string" },
      ref1: {
        type: "string",
        description: "First component reference (for route_pins)",
      },
      pin1: {
        type: "string",
        description: "First pin number (for route_pins)",
      },
      ref2: {
        type: "string",
        description: "Second component reference (for route_pins)",
      },
      pin2: {
        type: "string",
        description: "Second pin number (for route_pins)",
      },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const {
      action,
      start_x,
      start_y,
      end_x,
      end_y,
      uuid,
      ref1,
      pin1,
      ref2,
      pin2,
    } = args;

    switch (action) {
      case "create":
        const wire = sch.wires.add({
          start: { x: start_x, y: start_y },
          end: { x: end_x, y: end_y },
        });
        return { success: true, uuid: wire.uuid };

      case "route_pins":
        if (!ref1 || !pin1 || !ref2 || !pin2) {
          return { success: false, error: "INVALID_PARAMS" };
        }
        const routedWire = sch.addWireBetweenPins(ref1, pin1, ref2, pin2);
        return { success: true, uuid: routedWire.uuid };

      case "list":
        return {
          success: true,
          wires: sch.wires.all().map((w) => ({
            uuid: w.uuid,
            points: w.points,
          })),
        };

      case "delete":
        if (!uuid) {
          return { success: false, error: "INVALID_PARAMS" };
        }
        const deleted = sch.wires.remove(uuid);
        return { success: deleted };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

// 4. MANAGE LABEL
const manageLabel: ToolDefinition = {
  name: "manage_label",
  description: "CRUD operations for labels",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "read", "delete", "list"] },
      text: { type: "string" },
      position_x: { type: "number" },
      position_y: { type: "number" },
      rotation: { type: "number" },
      uuid: { type: "string" },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const { action, text, position_x, position_y, rotation, uuid } = args;

    switch (action) {
      case "create":
        const label = sch.labels.add({
          text,
          position: { x: position_x, y: position_y },
          rotation: rotation || 0,
        });
        return { success: true, uuid: label.uuid };

      case "list":
        return {
          success: true,
          labels: sch.labels.all().map((l) => ({
            uuid: l.uuid,
            text: l.text,
            position: l.position,
          })),
        };

      case "delete":
        const deleted = sch.labels.remove(uuid);
        return { success: deleted };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

// 5. MANAGE GLOBAL LABEL
const manageGlobalLabel: ToolDefinition = {
  name: "manage_global_label",
  description: "CRUD operations for global labels",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "read", "delete", "list"] },
      text: { type: "string" },
      position_x: { type: "number" },
      position_y: { type: "number" },
      shape: {
        type: "string",
        enum: ["input", "output", "bidirectional", "tri_state", "passive"],
      },
      uuid: { type: "string" },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const { action, text, position_x, position_y, shape, uuid } = args;

    switch (action) {
      case "create":
        const label = sch.labels.add({
          text,
          position: { x: position_x, y: position_y },
          type: LabelType.GLOBAL,
          shape: shape as HierarchicalLabelShape,
        });
        return { success: true, uuid: label.uuid };

      case "list":
        return {
          success: true,
          labels: sch.labels.getGlobalLabels().map((l) => ({
            uuid: l.uuid,
            text: l.text,
            position: l.position,
            shape: l.shape,
          })),
        };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

// 6. MANAGE POWER SYMBOL
const managePowerSymbol: ToolDefinition = {
  name: "manage_power_symbol",
  description: "CRUD operations for power symbols (VCC, GND, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "list"] },
      symbol: {
        type: "string",
        description: "Power symbol (e.g., VCC, GND, +5V)",
      },
      position_x: { type: "number" },
      position_y: { type: "number" },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const { action, symbol, position_x, position_y } = args;

    switch (action) {
      case "create":
        // Power symbols are special components from the power library
        const libId = `power:${symbol}`;
        const ref = `#PWR0${
          sch.components.filter((c) => c.libId.startsWith("power:")).length + 1
        }`;
        const comp = sch.components.add({
          libId,
          reference: ref,
          value: symbol,
          position: { x: position_x, y: position_y },
        });
        return { success: true, reference: comp.reference, uuid: comp.uuid };

      case "list":
        return {
          success: true,
          power_symbols: sch.components
            .filter((c) => c.libId.startsWith("power:"))
            .map((c) => ({
              reference: c.reference,
              value: c.value,
              position: c.position,
            })),
        };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

// 7. MANAGE SHEET (Hierarchical)
const manageSheet: ToolDefinition = {
  name: "manage_sheet",
  description: "CRUD operations for hierarchical sheets",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "read", "delete", "list"] },
      name: { type: "string" },
      filename: { type: "string" },
      position_x: { type: "number" },
      position_y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      uuid: { type: "string" },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const {
      action,
      name,
      filename,
      position_x,
      position_y,
      width,
      height,
      uuid,
    } = args;

    switch (action) {
      case "create":
        const sheet = sch.sheets.add({
          name,
          filename,
          position: { x: position_x, y: position_y },
          size: { width: width || 20, height: height || 15 },
        });
        return { success: true, uuid: sheet.uuid };

      case "list":
        return {
          success: true,
          sheets: sch.sheets.all().map((s) => ({
            uuid: s.uuid,
            name: s.name.value,
            filename: s.filename.value,
            position: s.position,
          })),
        };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

// 8. MANAGE TEXT BOX
const manageTextBox: ToolDefinition = {
  name: "manage_text_box",
  description: "CRUD operations for text boxes",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "read", "delete", "list"] },
      text: { type: "string" },
      position_x: { type: "number" },
      position_y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      uuid: { type: "string" },
    },
    required: ["action"],
  },
  handler: async (args) => {
    const sch = getCurrentSchematic();
    if (!sch) {
      return { success: false, error: "NO_SCHEMATIC_LOADED" };
    }

    const { action, text, position_x, position_y, width, height, uuid } = args;

    switch (action) {
      case "create":
        const textBox = sch.textBoxes.add({
          text,
          position: { x: position_x, y: position_y },
          size: { width: width || 50, height: height || 20 },
        });
        return { success: true, uuid: textBox.uuid };

      case "list":
        return {
          success: true,
          text_boxes: sch.textBoxes.all().map((t) => ({
            uuid: t.uuid,
            text: t.text,
            position: t.position,
          })),
        };

      default:
        return { success: false, error: "INVALID_ACTION" };
    }
  },
};

export const consolidatedTools: ToolDefinition[] = [
  manageSchematic,
  manageComponent,
  manageWire,
  manageLabel,
  manageGlobalLabel,
  managePowerSymbol,
  manageSheet,
  manageTextBox,
];
```

### Connectivity Tools (`src/adapters/mcp/tools/connectivity.ts`)

```typescript
// src/adapters/mcp/tools/connectivity.ts

export const connectivityTools: ToolDefinition[] = [
  {
    name: "analyze_connectivity",
    description: "Analyze schematic connectivity and return net information",
    inputSchema: {
      type: "object",
      properties: {
        include_power_nets: { type: "boolean", default: true },
      },
    },
    handler: async (args) => {
      const sch = getCurrentSchematic();
      if (!sch) {
        return { success: false, error: "NO_SCHEMATIC_LOADED" };
      }

      // Analyze connectivity
      const nets = analyzeConnectivity(sch);

      return {
        success: true,
        net_count: nets.length,
        nets: nets.map((net) => ({
          name: net.name,
          pin_count: net.pins.length,
          pins: net.pins,
        })),
      };
    },
  },
  {
    name: "check_pin_connection",
    description: "Check if two pins are electrically connected",
    inputSchema: {
      type: "object",
      properties: {
        ref1: { type: "string" },
        pin1: { type: "string" },
        ref2: { type: "string" },
        pin2: { type: "string" },
      },
      required: ["ref1", "pin1", "ref2", "pin2"],
    },
    handler: async (args) => {
      const sch = getCurrentSchematic();
      if (!sch) {
        return { success: false, error: "NO_SCHEMATIC_LOADED" };
      }

      const { ref1, pin1, ref2, pin2 } = args;
      const connected = checkPinConnection(sch, ref1, pin1, ref2, pin2);

      return {
        success: true,
        connected,
        message: connected
          ? `${ref1}.${pin1} is connected to ${ref2}.${pin2}`
          : `${ref1}.${pin1} is NOT connected to ${ref2}.${pin2}`,
      };
    },
  },
  {
    name: "trace_net",
    description: "Trace all connections on a net",
    inputSchema: {
      type: "object",
      properties: {
        net_name: { type: "string" },
        start_ref: { type: "string" },
        start_pin: { type: "string" },
      },
    },
    handler: async (args) => {
      const sch = getCurrentSchematic();
      if (!sch) {
        return { success: false, error: "NO_SCHEMATIC_LOADED" };
      }

      // Trace the net
      const trace = traceNet(
        sch,
        args.net_name || args.start_ref,
        args.start_pin
      );

      return {
        success: true,
        net_name: trace.name,
        components: trace.pins,
        labels: trace.labels,
        wires: trace.wires.length,
      };
    },
  },
];
```

### Pin Discovery Tools (`src/adapters/mcp/tools/pin-discovery.ts`)

```typescript
// src/adapters/mcp/tools/pin-discovery.ts

export const pinDiscoveryTools: ToolDefinition[] = [
  {
    name: "get_component_pins",
    description: "Get all pins for a component with their positions",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
      },
      required: ["reference"],
    },
    handler: async (args) => {
      const sch = getCurrentSchematic();
      if (!sch) {
        return { success: false, error: "NO_SCHEMATIC_LOADED" };
      }

      const component = sch.components.get(args.reference);
      if (!component) {
        return { success: false, error: "NOT_FOUND" };
      }

      // Get symbol definition
      const symbolDef = sch.symbolCache?.getSymbol(component.libId);
      if (!symbolDef) {
        return { success: false, error: "SYMBOL_NOT_FOUND" };
      }

      const pins: Array<{
        number: string;
        name: string;
        position: Point;
        type: string;
      }> = [];

      for (const unit of symbolDef.units.values()) {
        for (const pin of unit.pins) {
          const schematicPos = transformPinToSchematic(
            pin.position,
            component.position,
            component.rotation,
            component.mirror
          );
          pins.push({
            number: pin.number,
            name: pin.name,
            position: schematicPos,
            type: pin.electricalType,
          });
        }
      }

      return {
        success: true,
        reference: component.reference,
        lib_id: component.libId,
        pin_count: pins.length,
        pins,
      };
    },
  },
  {
    name: "search_symbols",
    description: "Search for symbols in the KiCAD library",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", default: 20 },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const cache = getSymbolCache();
      const results = cache.searchSymbols(args.query, args.limit || 20);

      return {
        success: true,
        count: results.length,
        symbols: results.map((s) => ({
          lib_id: s.libId,
          description: s.description,
          keywords: s.keywords,
          pin_count: Array.from(s.units.values()).reduce(
            (sum, u) => sum + u.pins.length,
            0
          ),
        })),
      };
    },
  },
];
```

---

## Phased Success Criteria

Complete each phase in order. Do not skip phases.

### Phase 1: Project Setup

- [ ] Initialize npm project with TypeScript
- [ ] Configure tsconfig.json for ES modules
- [ ] Set up Jest for testing
- [ ] Create directory structure matching the file layout above
- [ ] Copy reference test fixtures from Python project's `tests/reference_kicad_projects/`

### Phase 2: Core Types

- [ ] Implement all interfaces in `src/core/types.ts`
- [ ] Implement all enums (PinType, WireType, LabelType, etc.)
- [ ] Implement Point, Rectangle, Size interfaces
- [ ] Implement TextEffects, PropertyValue interfaces
- [ ] Implement SchematicSymbol, Wire, Label, Junction, etc.
- [ ] Implement SymbolDefinition, SymbolUnit, SymbolPin

### Phase 3: S-Expression Parser

- [ ] Implement Symbol class for S-expression atoms
- [ ] Implement tokenizer for S-expressions
- [ ] Implement recursive descent parser
- [ ] Handle strings with escape sequences
- [ ] Handle numbers (integers, floats, scientific notation)
- [ ] Handle nested lists
- [ ] Pass unit tests for parsing

### Phase 4: S-Expression Formatter

- [ ] Implement ExactFormatter class
- [ ] Handle inline vs block elements
- [ ] Handle proper indentation with tabs
- [ ] Handle string quoting and escaping
- [ ] Handle number formatting (trailing zeros)
- [ ] Pass round-trip tests for all reference files

### Phase 5: Exceptions

- [ ] Implement KiCadSchError base class
- [ ] Implement ParseError, FormatError
- [ ] Implement ValidationError
- [ ] Implement ElementNotFoundError, DuplicateElementError
- [ ] Implement LibraryError, SymbolNotFoundError
- [ ] Implement ConnectivityError, HierarchyError

### Phase 6: Configuration

- [ ] Implement KiCADConfig class
- [ ] Implement GridSettings, PositioningSettings
- [ ] Implement ToleranceSettings
- [ ] Implement getPropertyPosition helper
- [ ] Export global config instance

### Phase 7: Base Collections

- [ ] Implement IndexRegistry class
- [ ] Implement BaseCollection abstract class
- [ ] Implement add, remove, get, filter, find methods
- [ ] Implement iteration support
- [ ] Implement modification tracking

### Phase 8: Specific Collections

- [ ] Implement ComponentCollection with Component wrapper
- [ ] Implement WireCollection
- [ ] Implement LabelCollection (local, global, hierarchical)
- [ ] Implement JunctionCollection
- [ ] Implement NoConnectCollection
- [ ] Implement BusCollection, BusEntryCollection
- [ ] Implement SheetCollection
- [ ] Implement TextCollection, TextBoxCollection
- [ ] Implement RectangleCollection, ImageCollection

### Phase 9: Manager Classes

- [ ] Implement BaseManager
- [ ] Implement FileIOManager
- [ ] Implement MetadataManager
- [ ] Implement FormatSyncManager
- [ ] Implement WireManager with routing
- [ ] Implement SheetManager
- [ ] Implement HierarchyManager
- [ ] Implement ValidationManager
- [ ] Implement TextElementsManager
- [ ] Implement GraphicsManager

### Phase 10: Schematic Class

- [ ] Implement Schematic class with all managers
- [ ] Implement static factory methods (load, create, fromString)
- [ ] Implement parsing for all element types
- [ ] Implement toSexp serialization for all elements
- [ ] Implement format() method
- [ ] Implement save() method
- [ ] Implement getComponentPinPosition()
- [ ] Implement addWireBetweenPins()
- [ ] Implement validate()
- [ ] Pass round-trip tests

### Phase 11: Symbol Library Cache

- [ ] Implement library path discovery
- [ ] Implement .kicad_sym file parsing
- [ ] Implement symbol definition parsing
- [ ] Implement pin parsing
- [ ] Implement graphics parsing
- [ ] Implement symbol search
- [ ] Implement caching with performance stats

### Phase 12: Geometry Module

- [ ] Implement createOrthogonalRouting()
- [ ] Implement RoutingResult and CornerDirection
- [ ] Implement BoundingBox utilities
- [ ] Implement SymbolBoundingBoxCalculator
- [ ] Implement getComponentBoundingBox()
- [ ] Implement transformBoundingBox()

### Phase 13: Validation/ERC Module

- [ ] Implement ERCViolation, ERCResult, ERCConfig
- [ ] Implement PinConflictMatrix
- [ ] Implement ElectricalRulesChecker
- [ ] Implement duplicate reference check
- [ ] Implement off-grid check
- [ ] Implement pin conflict check

### Phase 14: BOM Module

- [ ] Implement ComponentIssue interface
- [ ] Implement BOMPropertyAuditor
- [ ] Implement auditSchematic()
- [ ] Implement auditDirectory()
- [ ] Implement generateCsvReport()
- [ ] Implement PropertyMatcher

### Phase 15: Discovery Module

- [ ] Set up SQLite database (better-sqlite3)
- [ ] Implement ComponentSearchIndex
- [ ] Implement rebuildIndex()
- [ ] Implement full-text search
- [ ] Implement searchByLibrary()

### Phase 16: Exporters Module

- [ ] Implement PythonCodeGenerator
- [ ] Implement component code generation
- [ ] Implement wire code generation
- [ ] Implement label code generation
- [ ] Handle all template styles

### Phase 17: CLI Adapter

- [ ] Set up Commander.js
- [ ] Implement `test` command
- [ ] Implement `status` command
- [ ] Implement `bom` command
- [ ] Implement `bom-manage` command
- [ ] Implement `erc` command
- [ ] Implement `find-libraries` command
- [ ] Implement `kicad-to-python` command
- [ ] Implement `netlist` command
- [ ] Implement `demo` command
- [ ] Implement `setup-claude` command

### Phase 18: MCP Server Adapter

- [ ] Set up MCP SDK
- [ ] Implement server initialization
- [ ] Implement manage_schematic tool
- [ ] Implement manage_component tool
- [ ] Implement manage_wire tool
- [ ] Implement manage_label tool
- [ ] Implement manage_global_label tool
- [ ] Implement manage_power_symbol tool
- [ ] Implement manage_sheet tool
- [ ] Implement manage_text_box tool
- [ ] Implement connectivity tools
- [ ] Implement pin discovery tools

### Phase 19: Integration Testing

- [ ] All round-trip tests pass
- [ ] Component manipulation tests pass
- [ ] Wire routing tests pass
- [ ] Connectivity analysis tests pass
- [ ] Hierarchy tests pass
- [ ] CLI end-to-end tests pass

### Phase 20: Documentation & Packaging

- [ ] Write README.md
- [ ] Add JSDoc comments to public API
- [ ] Configure package.json for npm publishing
- [ ] Set up bin entry for CLI
- [ ] Create example scripts

---

## Mandatory Test Cases

All tests MUST pass before the port is considered complete.

### Test 1: Round-Trip Blank Schematic

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

### Test 2: Round-Trip Single Resistor

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

### Test 3: Round-Trip All Rotations

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

### Test 4: Add Component

```typescript
describe("Component Operations", () => {
  it("should add a component", () => {
    const sch = Schematic.create("Test");

    const component = sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });

    expect(component.reference).toBe("R1");
    expect(component.value).toBe("10k");
    expect(component.libId).toBe("Device:R");
    expect(component.position).toEqual({ x: 100, y: 100 });
  });
});
```

### Test 5: Modify Component Properties

```typescript
it("should modify component properties", () => {
  const sch = Schematic.create("Test");

  const component = sch.components.add({
    libId: "Device:R",
    reference: "R1",
    value: "10k",
    position: { x: 100, y: 100 },
  });

  component.value = "20k";
  component.setProperty("Tolerance", "1%");
  component.footprint = "Resistor_SMD:R_0603_1608Metric";

  expect(component.value).toBe("20k");
  expect(component.getProperty("Tolerance")).toBe("1%");
  expect(component.footprint).toBe("Resistor_SMD:R_0603_1608Metric");
});
```

### Test 6: Add Wire

```typescript
describe("Wire Operations", () => {
  it("should add a wire", () => {
    const sch = Schematic.create("Test");

    const wire = sch.wires.add({
      start: { x: 100, y: 100 },
      end: { x: 150, y: 100 },
    });

    expect(wire.points).toHaveLength(2);
    expect(wire.points[0]).toEqual({ x: 100, y: 100 });
    expect(wire.points[1]).toEqual({ x: 150, y: 100 });
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
      position: { x: 100, y: 100 },
    });

    expect(label.text).toBe("VCC");
    expect(label.position).toEqual({ x: 100, y: 100 });
  });

  it("should add a global label", () => {
    const sch = Schematic.create("Test");

    const label = sch.labels.add({
      text: "CLK",
      position: { x: 100, y: 100 },
      type: LabelType.GLOBAL,
      shape: HierarchicalLabelShape.INPUT,
    });

    expect(label.text).toBe("CLK");
    expect((label as GlobalLabel).shape).toBe(HierarchicalLabelShape.INPUT);
  });
});
```

### Test 8: Add Junction

```typescript
describe("Junction Operations", () => {
  it("should add a junction", () => {
    const sch = Schematic.create("Test");

    const junction = sch.junctions.add({
      position: { x: 100, y: 100 },
    });

    expect(junction.position).toEqual({ x: 100, y: 100 });
  });
});
```

### Test 9: Grid Alignment

```typescript
describe("Grid Alignment", () => {
  it("should snap to grid", () => {
    const point = snapToGrid({ x: 100.5, y: 101.3 });
    expect(point.x).toBeCloseTo(100.33, 2); // 79 * 1.27 = 100.33
    expect(point.y).toBeCloseTo(101.6, 2); // 80 * 1.27 = 101.6
  });
});
```

### Test 10: Coordinate Transformation

```typescript
describe("Coordinate Transformation", () => {
  it("should transform pin position to schematic space", () => {
    // Pin at (0, 3.81) in symbol space (pointing UP)
    // Component at (100, 100) with 0 rotation
    const schematicPos = transformPinToSchematic(
      { x: 0, y: 3.81 },
      { x: 100, y: 100 },
      0
    );

    // Y is negated: 100 + (-3.81) = 96.19
    expect(schematicPos.x).toBeCloseTo(100, 2);
    expect(schematicPos.y).toBeCloseTo(96.19, 2);
  });

  it("should handle 90 degree rotation", () => {
    const schematicPos = transformPinToSchematic(
      { x: 0, y: 3.81 },
      { x: 100, y: 100 },
      90
    );

    // After Y negation: (0, -3.81)
    // After 90° rotation: (3.81, 0)
    // After translation: (103.81, 100)
    expect(schematicPos.x).toBeCloseTo(103.81, 2);
    expect(schematicPos.y).toBeCloseTo(100, 2);
  });
});
```

### Test 11: Symbol Library Cache

```typescript
describe("Symbol Library Cache", () => {
  it("should find Device:R symbol", () => {
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
    expect(results.some((s) => s.name === "R")).toBe(true);
  });
});
```

### Test 12: Multi-Unit Component

```typescript
describe("Multi-Unit Components", () => {
  it("should handle TL072 dual op-amp", () => {
    const original = readFileSync(
      "test/fixtures/multi_unit_tl072/multi_unit_tl072.kicad_sch",
      "utf-8"
    );
    const sch = Schematic.fromString(original);

    // TL072 has 2 op-amp units + 1 power unit
    const tl072Components = sch.components.findByLibId(
      "Amplifier_Operational:TL072"
    );
    expect(tl072Components.length).toBeGreaterThan(0);

    // Round-trip should preserve
    const output = sch.format();
    expect(output).toEqual(original.trim());
  });
});
```

### Test 13: Connectivity Analysis

```typescript
describe("Connectivity Analysis", () => {
  it("should detect connected pins", () => {
    const sch = Schematic.load(
      "test/fixtures/connectivity/simple_connection/simple_connection.kicad_sch"
    );

    // Assuming R1 pin 2 is connected to R2 pin 1
    const connected = checkPinConnection(sch, "R1", "2", "R2", "1");
    expect(connected).toBe(true);
  });

  it("should detect label connections", () => {
    const sch = Schematic.load(
      "test/fixtures/connectivity/label_connection/label_connection.kicad_sch"
    );

    // Components connected via labels with same name
    const nets = analyzeConnectivity(sch);
    const vccNet = nets.find((n) => n.name === "VCC");
    expect(vccNet).toBeDefined();
    expect(vccNet?.pins.length).toBeGreaterThan(1);
  });
});
```

### Test 14: Hierarchy

```typescript
describe("Hierarchy", () => {
  it("should build hierarchy tree", () => {
    const sch = Schematic.load(
      "test/fixtures/hierarchical/hierarchical.kicad_sch"
    );

    const tree = sch.hierarchy.buildHierarchyTree();
    expect(tree).toBeDefined();
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it("should validate sheet pins", () => {
    const sch = Schematic.load(
      "test/fixtures/hierarchical/hierarchical.kicad_sch"
    );
    sch.hierarchy.buildHierarchyTree();

    const issues = sch.hierarchy.validateSheetPins();
    // Should have no issues in a valid schematic
    expect(issues.filter((i) => i.type === "error")).toHaveLength(0);
  });
});
```

### Test 15: ERC

```typescript
describe("ERC", () => {
  it("should detect duplicate references", () => {
    const sch = Schematic.create("Test");

    sch.components.add({
      libId: "Device:R",
      reference: "R1",
      value: "10k",
      position: { x: 100, y: 100 },
    });
    // Force duplicate (normally prevented by collection)
    (sch.components as any).items.push({
      uuid: "test",
      libId: "Device:R",
      reference: "R1",
      value: "20k",
      position: { x: 150, y: 100 },
    });

    const checker = new ElectricalRulesChecker(sch);
    const result = checker.check();

    expect(
      result.violations.some((v) => v.code === "DUPLICATE_REFERENCE")
    ).toBe(true);
  });
});
```

### Test 16: BOM Audit

```typescript
describe("BOM Audit", () => {
  it("should find missing properties", () => {
    const auditor = new BOMPropertyAuditor();
    const issues = auditor.auditSchematic(
      "test/fixtures/single_resistor/single_resistor.kicad_sch",
      ["PartNumber", "Manufacturer"]
    );

    // Single resistor likely missing PartNumber and Manufacturer
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].missingProperties).toContain("PartNumber");
  });
});
```

### Test 17: Python Export

```typescript
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
    expect(code).toContain("R1");
  });
});
```

### Test 18: CLI Demo Command

```typescript
import { execSync } from "child_process";

describe("CLI", () => {
  it("should run demo command", () => {
    const output = execSync(
      "npx ts-node src/adapters/cli/index.ts demo -o /tmp/test_demo.kicad_sch",
      {
        encoding: "utf-8",
      }
    );

    expect(output).toContain("Demo schematic created");
    expect(existsSync("/tmp/test_demo.kicad_sch")).toBe(true);
  });

  it("should run test command", () => {
    const output = execSync("npx ts-node src/adapters/cli/index.ts test", {
      encoding: "utf-8",
    });

    expect(output).toContain("All tests passed");
  });
});
```

### Test 19: Orthogonal Routing

```typescript
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

### Test 20: Bounding Box

```typescript
describe("Bounding Box", () => {
  it("should calculate component bounding box", () => {
    const sch = Schematic.load(
      "test/fixtures/single_resistor/single_resistor.kicad_sch"
    );
    sch.symbolCache = getSymbolCache();

    const component = sch.components.get("R1");
    expect(component).toBeDefined();

    const bbox = getComponentBoundingBox(component!, sch.symbolCache);
    expect(bbox).toBeDefined();
    expect(getBoundingBoxWidth(bbox!)).toBeGreaterThan(0);
    expect(getBoundingBoxHeight(bbox!)).toBeGreaterThan(0);
  });
});
```

---

## File Structure

```
kicad-sch-ts/
├── package.json
├── tsconfig.json
├── jest.config.js
├── README.md
├── src/
│   ├── index.ts                          # Main entry point, re-exports public API
│   ├── core/
│   │   ├── types.ts                      # All interfaces and enums
│   │   ├── exceptions.ts                 # Error classes
│   │   ├── config.ts                     # Configuration
│   │   ├── parser.ts                     # S-expression parser
│   │   ├── formatter.ts                  # S-expression formatter
│   │   ├── schematic.ts                  # Main Schematic class
│   │   ├── collections/
│   │   │   ├── base.ts                   # BaseCollection, IndexRegistry
│   │   │   ├── component.ts              # ComponentCollection, Component wrapper
│   │   │   ├── wire.ts                   # WireCollection
│   │   │   ├── bus.ts                    # BusCollection, BusEntryCollection
│   │   │   ├── label.ts                  # LabelCollection (all types)
│   │   │   ├── junction.ts               # JunctionCollection
│   │   │   ├── no-connect.ts             # NoConnectCollection
│   │   │   ├── sheet.ts                  # SheetCollection
│   │   │   ├── text.ts                   # TextCollection, TextBoxCollection
│   │   │   ├── graphics.ts               # RectangleCollection, ImageCollection
│   │   │   └── index.ts                  # Re-exports
│   │   ├── managers/
│   │   │   ├── base.ts                   # BaseManager
│   │   │   ├── file-io.ts                # FileIOManager
│   │   │   ├── metadata.ts               # MetadataManager
│   │   │   ├── format-sync.ts            # FormatSyncManager
│   │   │   ├── wire.ts                   # WireManager
│   │   │   ├── sheet.ts                  # SheetManager
│   │   │   ├── hierarchy.ts              # HierarchyManager
│   │   │   ├── validation.ts             # ValidationManager
│   │   │   ├── text-elements.ts          # TextElementsManager
│   │   │   ├── graphics.ts               # GraphicsManager
│   │   │   └── index.ts                  # Re-exports
│   │   └── parsers/
│   │       ├── symbol-parser.ts          # Symbol/component parsing
│   │       ├── wire-parser.ts            # Wire parsing
│   │       ├── label-parser.ts           # Label parsing
│   │       └── index.ts                  # Re-exports
│   ├── library/
│   │   ├── cache.ts                      # SymbolLibraryCache
│   │   └── index.ts
│   ├── geometry/
│   │   ├── routing.ts                    # Orthogonal routing
│   │   ├── symbol-bbox.ts                # Bounding box calculations
│   │   ├── font-metrics.ts               # Font/text metrics
│   │   └── index.ts
│   ├── validation/
│   │   ├── erc-models.ts                 # ERC types
│   │   ├── pin-matrix.ts                 # Pin conflict matrix
│   │   ├── erc.ts                        # ElectricalRulesChecker
│   │   └── index.ts
│   ├── bom/
│   │   ├── auditor.ts                    # BOMPropertyAuditor
│   │   ├── matcher.ts                    # PropertyMatcher
│   │   └── index.ts
│   ├── discovery/
│   │   ├── search-index.ts               # ComponentSearchIndex
│   │   └── index.ts
│   ├── exporters/
│   │   ├── python-generator.ts           # PythonCodeGenerator
│   │   └── index.ts
│   ├── connectivity/
│   │   ├── analyzer.ts                   # Connectivity analysis
│   │   └── index.ts
│   └── adapters/
│       ├── cli/
│       │   ├── index.ts                  # CLI entry point
│       │   ├── bom.ts                    # bom command
│       │   ├── bom-manage.ts             # bom-manage command
│       │   ├── erc.ts                    # erc command
│       │   ├── export-docs.ts            # export-docs command
│       │   ├── find-libraries.ts         # find-libraries command
│       │   ├── kicad-to-python.ts        # kicad-to-python command
│       │   ├── netlist.ts                # netlist command
│       │   ├── setup-claude.ts           # setup-claude command
│       │   └── demo.ts                   # demo command
│       └── mcp/
│           ├── server.ts                 # MCP server
│           └── tools/
│               ├── consolidated.ts       # 8 consolidated tools
│               ├── component.ts          # Component tools
│               ├── connectivity.ts       # Connectivity tools
│               └── pin-discovery.ts      # Pin discovery tools
├── test/
│   ├── unit/
│   │   ├── parser.test.ts
│   │   ├── formatter.test.ts
│   │   ├── types.test.ts
│   │   └── ...
│   ├── integration/
│   │   ├── round-trip.test.ts
│   │   ├── component-ops.test.ts
│   │   ├── connectivity.test.ts
│   │   └── ...
│   └── fixtures/
│       ├── blank/
│       ├── single_resistor/
│       ├── rotated_resistor_0deg/
│       ├── rotated_resistor_90deg/
│       ├── rotated_resistor_180deg/
│       ├── rotated_resistor_270deg/
│       ├── multi_unit_tl072/
│       ├── hierarchical/
│       └── connectivity/
└── bin/
    └── kicad-sch.js                      # CLI binary entry
```

---

## Dependencies

```json
{
  "name": "kicad-sch-ts",
  "version": "1.0.0",
  "description": "TypeScript library for reading, writing, and manipulating KiCAD schematic files",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "kicad-sch": "./bin/kicad-sch.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "better-sqlite3": "^9.0.0",
    "@modelcontextprotocol/sdk": "^0.5.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.5",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["kicad", "schematic", "eda", "electronics", "circuit"],
  "license": "MIT"
}
```

---

## ⚠️ TRAPS TO AVOID

### 1. Coordinate System Confusion

**CRITICAL:** KiCAD uses TWO different coordinate systems:

| System              | Y-Axis Direction      | Where Used                       |
| ------------------- | --------------------- | -------------------------------- |
| **Symbol Space**    | +Y is UP (normal)     | Library symbol definitions       |
| **Schematic Space** | +Y is DOWN (inverted) | Placed components, wires, labels |

**The Y-Negation Rule:** When transforming from symbol space to schematic space, Y coordinates MUST be negated:

```typescript
// WRONG - will produce incorrect positions
function transformPinWRONG(pinPos: Point, componentPos: Point): Point {
  return {
    x: componentPos.x + pinPos.x,
    y: componentPos.y + pinPos.y, // BUG: Y not negated
  };
}

// CORRECT - Y is negated
function transformPinCORRECT(pinPos: Point, componentPos: Point): Point {
  return {
    x: componentPos.x + pinPos.x,
    y: componentPos.y - pinPos.y, // Y negated for symbol-to-schematic
  };
}
```

### 2. Grid Alignment

ALL positions MUST be on a 1.27mm (50 mil) grid. Off-grid positions cause connectivity issues.

```typescript
// WRONG - arbitrary position
const position = { x: 100.5, y: 101.3 };

// CORRECT - snapped to grid
const position = snapToGrid({ x: 100.5, y: 101.3 });
// Result: { x: 100.33, y: 101.6 } (nearest grid points)
```

### 3. S-Expression Formatting

KiCAD is VERY particular about formatting. The formatter must:

- Use tabs for indentation, not spaces
- Preserve trailing zeros on floats (e.g., `1.270` not `1.27`)
- Quote strings containing spaces or special characters
- Maintain exact element ordering

### 4. UUID Handling

Every element has a UUID. When creating new elements, generate proper UUIDs:

```typescript
import { randomUUID } from "crypto";

const uuid = randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### 5. Multi-Unit Components

Components like TL072 (dual op-amp) have multiple units. Each unit is a separate symbol instance but shares the same reference (e.g., U1A, U1B). Handle the `unit` field correctly.

### 6. Property Positioning

Component properties (Reference, Value, Footprint) have their own positions relative to the component. These positions are also affected by the coordinate transformation.

### 7. lib_symbols Section

The `lib_symbols` section in a schematic contains cached copies of symbol definitions. When adding new components, you may need to add their symbol definitions to this section.

### 8. Symbol Instances

The `symbol_instances` section at the end of the file contains path-based instance data. This is critical for hierarchical designs and must be preserved.

### 9. String Escaping in S-Expressions

Strings in S-expressions may contain special characters that need escaping:

- Newlines: `\n`
- Quotes: `\"`
- Backslashes: `\\`

### 10. Rotation Values

Rotations are in degrees and typically multiples of 90 (0, 90, 180, 270). Some elements support arbitrary rotations.

---

## Agent Instructions

1. **Work Phase by Phase:** Complete each phase before moving to the next. Do not skip phases.

2. **Run Tests Frequently:** After implementing each feature, run the relevant tests. Fix failures before proceeding.

3. **Use Reference Files:** The Python project's `tests/reference_kicad_projects/` directory contains known-good KiCAD files. Use these for round-trip testing.

4. **Commit Often:** Make small, focused commits after completing each feature or fixing each bug.

5. **Read Python Code:** When stuck, refer to the Python implementation. The logic should be similar, just adapted for TypeScript.

6. **Format Preservation is Critical:** The library's key feature is exact format preservation. If round-trip tests fail, focus on the formatter.

7. **Test with Real KiCAD:** Open generated files in KiCAD to verify they work correctly.

8. **Signal Completion:** When all tests pass and all phases are complete, output:
   ```
   ✅ PORT COMPLETE: All 20 phases finished, all tests passing.
   ```

---

## Reference: Python Project Structure

For reference, here is the Python project's structure:

```
kicad-sch-api/
├── kicad_sch_api/
│   ├── __init__.py
│   ├── core/
│   │   ├── schematic.py          # 2107 lines
│   │   ├── types.py              # 1215 lines
│   │   ├── parser.py             # 1033 lines
│   │   ├── formatter.py          # 1105 lines
│   │   ├── exceptions.py         # 145 lines
│   │   ├── config.py             # 314 lines
│   │   ├── collections/          # ~2000 lines total
│   │   └── managers/             # ~2500 lines total
│   ├── library/
│   │   └── cache.py              # 1430 lines
│   ├── geometry/
│   │   ├── routing.py            # 202 lines
│   │   └── symbol_bbox.py        # 608 lines
│   ├── validation/
│   │   ├── erc.py                # 167 lines
│   │   └── pin_matrix.py         # 242 lines
│   ├── bom/
│   │   └── auditor.py            # 297 lines
│   ├── discovery/
│   │   └── search_index.py       # 456 lines
│   ├── exporters/
│   │   └── python_generator.py   # 607 lines
│   ├── cli/                      # ~1500 lines total
│   └── mcp_server/               # ~3000 lines total
└── tests/
    ├── reference_kicad_projects/
    └── reference_tests/
```

Total: ~37,852 lines of Python code.

---

## Completion Checklist

Before declaring the port complete, verify:

- [ ] All 20 phases completed
- [ ] All 20 mandatory tests passing
- [ ] Round-trip tests pass for ALL reference files
- [ ] CLI commands work correctly
- [ ] MCP server starts and responds to tool calls
- [ ] Generated files open correctly in KiCAD 8
- [ ] README.md written with usage examples
- [ ] Package can be installed via npm

**When complete, output:**

```
✅ PORT COMPLETE: kicad-sch-ts v1.0.0 ready for release.
   - 20/20 phases complete
   - XX/XX tests passing
   - Round-trip verification: PASSED
   - KiCAD 8 compatibility: VERIFIED
```
