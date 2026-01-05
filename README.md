# kicad-sch-ts

A TypeScript library for programmatically reading, writing, and manipulating KiCAD 7/8 schematic files.

## Features

- **Round-trip fidelity**: Load and save schematic files without losing any data
- **Full type safety**: Complete TypeScript definitions for all KiCAD schematic elements
- **Rich CLI**: Command-line tools for common operations
- **MCP Server**: AI assistant integration via Model Context Protocol
- **Comprehensive API**: Work with components, wires, labels, sheets, and more

## Installation

```bash
npm install kicad-sch-ts
```

## Quick Start

```typescript
import { Schematic } from 'kicad-sch-ts';

// Load an existing schematic
const sch = Schematic.load('my_project.kicad_sch');

// Access components
for (const component of sch.components) {
  console.log(`${component.reference}: ${component.value}`);
}

// Access wires
console.log(`Wires: ${sch.wires.length}`);

// Save (preserves round-trip fidelity)
sch.save('my_project.kicad_sch');
```

## CLI Usage

```bash
# Create a demo schematic
kicad-sch demo -o demo.kicad_sch

# Run Electrical Rules Check
kicad-sch erc my_project.kicad_sch

# Audit BOM properties
kicad-sch bom my_project.kicad_sch -p PartNumber,Manufacturer

# Generate BOM CSV
kicad-sch bom-manage my_project.kicad_sch -o bom.csv

# Search for symbols
kicad-sch find-libraries -s resistor

# Extract netlist
kicad-sch netlist my_project.kicad_sch

# Convert to Python code
kicad-sch kicad-to-python my_project.kicad_sch -o generate.py

# Export documentation
kicad-sch export-docs my_project.kicad_sch -f markdown

# Start MCP server for AI assistants
kicad-sch mcp
```

## API Reference

### Schematic Class

```typescript
// Load a schematic
const sch = Schematic.load('path/to/schematic.kicad_sch');

// Create a new schematic
const sch = Schematic.create('My Schematic');

// Parse from string
const sch = Schematic.fromString(content);

// Save
sch.save('output.kicad_sch');

// Format to string
const content = sch.format();
```

### Component Collection

```typescript
// Add a component
sch.components.add({
  libId: 'Device:R',
  reference: 'R1',
  value: '10k',
  position: { x: 100.33, y: 101.6 },
});

// Get by reference
const comp = sch.components.get('R1');

// Iterate
for (const comp of sch.components) {
  console.log(comp.reference, comp.value);
}

// Modify
const r1 = sch.components.get('R1');
r1.value = '20k';
r1.setProperty('Manufacturer', 'Yageo');

// Remove
sch.components.remove('R1');
```

### Wire Collection

```typescript
// Add a wire
sch.wires.add({
  start: { x: 100.33, y: 101.6 },
  end: { x: 106.68, y: 101.6 },
});

// Find wires at a point
const wires = sch.wires.findAtPoint({ x: 100.33, y: 101.6 });
```

### Label Collection

```typescript
// Add labels
sch.labels.add({ text: 'VCC', position: { x: 50, y: 50 } });
sch.labels.addGlobal({ text: 'GND', position: { x: 60, y: 60 } });
sch.labels.addHierarchical({
  text: 'DATA',
  position: { x: 70, y: 70 },
  shape: 'bidirectional',
});
```

### Analysis Tools

```typescript
import {
  ConnectivityAnalyzer,
  ElectricalRulesChecker,
  BOMPropertyAuditor,
  HierarchyManager,
} from 'kicad-sch-ts';

// Connectivity analysis
const analyzer = new ConnectivityAnalyzer(sch);
const nets = analyzer.analyzeNets();
const unconnected = analyzer.findUnconnectedPins();

// ERC
const checker = new ElectricalRulesChecker(sch);
const result = checker.check();
console.log(`Passed: ${result.passed}, Errors: ${result.errorCount}`);

// BOM auditing
const auditor = new BOMPropertyAuditor();
const issues = auditor.auditSchematic(path, ['PartNumber', 'Manufacturer']);

// Hierarchy management
const hierarchy = new HierarchyManager(sch);
const tree = hierarchy.buildHierarchyTree(true);
const allComponents = hierarchy.getAllComponents();
```

### Symbol Library

```typescript
import { getSymbolCache } from 'kicad-sch-ts';

const cache = getSymbolCache();

// Search for symbols
const results = cache.searchSymbols('resistor', 20);

// Get specific symbol
const symbol = cache.getSymbol('Device:R');
```

## MCP Server

For AI assistant integration, start the MCP server:

```bash
kicad-sch mcp
```

The server provides tools for:
- `manage_schematic`: Create, load, save schematics
- `manage_component`: Add, modify, remove components
- `manage_wire`: Add, remove wires
- `manage_label`: Add, remove labels
- `analyze_connectivity`: Analyze nets and connections
- `analyze_hierarchy`: Analyze hierarchical structure
- `run_erc`: Run electrical rules check
- `search_symbols`: Search symbol libraries
- `get_symbol_info`: Get detailed symbol information
- `discover_pins`: Find pins at positions

## TypeScript Advantages

- **Static typing**: Rich editor hints and compile-time checks for schematic data.
- **Speed**: Faster analysis and tool execution in Node.js workflows.
- **Ergonomics**: Convenient helpers for hierarchy, search, and parity-focused APIs.

## Python → TypeScript Migration

- `Schematic.load(...)` / `Schematic.create(...)` are direct equivalents.
- Collections map 1:1 (`components`, `wires`, `labels`, `sheets`).
- Analysis classes carry the same semantics (`ConnectivityAnalyzer`, `ElectricalRulesChecker`, `HierarchyManager`).
- For scripting, use Node.js tooling instead of Python entry points.

## Recipes

### BOM Audit

```typescript
import { BOMPropertyAuditor } from "kicad-sch-ts";

const auditor = new BOMPropertyAuditor();
const report = auditor.auditSchematic("my_project.kicad_sch", [
  "PartNumber",
  "Manufacturer",
]);
console.log(report);
```

### ERC

```typescript
import { ElectricalRulesChecker, Schematic } from "kicad-sch-ts";

const sch = Schematic.load("my_project.kicad_sch");
const checker = new ElectricalRulesChecker(sch);
const result = checker.check();
console.log(result);
```

### Connectivity

```typescript
import { ConnectivityAnalyzer, Schematic } from "kicad-sch-ts";

const sch = Schematic.load("my_project.kicad_sch");
const analyzer = new ConnectivityAnalyzer(sch);
const nets = analyzer.analyzeNets();
console.log(nets.map((net) => net.name));
```

## Testing

```bash
npm test
```

`npm test` runs a `pretest` step that rebuilds `better-sqlite3`. If it fails, install native build tools (e.g. `xcode-select --install` on macOS) and retry.

## Compatibility

- **Node.js**: 18.0.0 or later
- **KiCAD**: 7.x, 8.x schematic format

## Parity + Limitations

Parity status and limitation decisions are tracked in `PARITY.md`, including a module-by-module matrix and rationale for match/improve/defer calls.

Recent parity improvements include multi-unit helpers, intersection-aware connectivity, symbol-geometry property positioning, and lightweight logging utilities.

## Known Limitations

- See `PARITY.md` for any currently tracked limitations or deferred items.

## License

MIT
