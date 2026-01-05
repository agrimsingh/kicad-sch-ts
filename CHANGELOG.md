# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Logger utilities with configurable levels and error formatting.
- Connectivity fixtures covering crossings, T-junctions, and overlaps.

### Changed
- Connectivity analysis now unions T-junctions, overlaps, and junction-crossing wires.
- Property positioning derives offsets from symbol geometry when library offsets are missing.

### Parity Regressions
- None.

## [1.0.0] - 2026-01-05

### Added

#### Core Engine (Part 1)
- S-expression parser with full KiCAD format support
- Exact formatter for round-trip fidelity
- Complete type definitions for all schematic elements
- Component, Wire, Label, Junction, NoConnect collections
- Bus, BusEntry, Sheet, Text, TextBox, Rectangle collections
- Sheet instance and symbol instance support
- Round-trip tests for all KiCAD element types

#### Analysis & Library (Part 2)
- Symbol Library Cache with auto-discovery of KiCAD paths
- Symbol search and retrieval
- Geometry utilities (grid snapping, orthogonal routing)
- Bounding box calculations
- Connectivity Analyzer with Union-Find algorithm
- Net analysis and unconnected pin detection
- Hierarchy Manager for sheet navigation
- Sheet pin validation
- Electrical Rules Checker (ERC)
  - Duplicate reference detection
  - Off-grid checks
  - Missing footprint/value warnings
  - Floating label detection
- BOM Property Auditor with CSV export
- Component Search Index
- Python Code Generator with multiple templates

#### Adapters (Part 3)
- CLI with 9 commands:
  - `demo`: Create sample schematics
  - `bom`: Audit BOM properties
  - `bom-manage`: Generate BOM CSV
  - `erc`: Run electrical rules check
  - `netlist`: Extract netlist
  - `find-libraries`: Search symbol libraries
  - `kicad-to-python`: Convert to Python code
  - `export-docs`: Generate documentation
  - `mcp`: Start MCP server
- MCP Server with 10 tools for AI assistant integration
- Complete test coverage (167 tests)

### Technical Details
- TypeScript with strict mode
- Jest for testing
- Compatible with KiCAD 7.x and 8.x schematic formats
- Node.js 18+ required

## [0.1.0] - 2026-01-05

### Added
- Initial project structure
- Basic S-expression parsing
