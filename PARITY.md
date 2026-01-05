# Parity Matrix and Limitations

This document tracks feature parity between the Python `kicad_sch_api` and this TypeScript implementation.

## Parity Matrix

| Python module | TS module | Status | Tests |
| --- | --- | --- | --- |
| `kicad_sch_api/core/parser.py` | `src/core/parser.ts` | Implemented | `test/unit/parser.test.ts` |
| `kicad_sch_api/core/formatter.py` | `src/core/formatter.ts` | Implemented | `test/unit/formatter.test.ts` |
| `kicad_sch_api/core/schematic.py` | `src/core/schematic.ts` | Implemented (round-trip for loaded files) | `test/integration/round-trip.test.ts` |
| `kicad_sch_api/core/types.py` | `src/core/types.ts` | Implemented | Covered indirectly |
| `kicad_sch_api/core/exceptions.py` | `src/core/exceptions.ts` | Implemented | Covered indirectly |
| `kicad_sch_api/collections/*` | `src/core/collections/*` | Implemented | `test/integration/round-trip.test.ts` |
| `kicad_sch_api/core/managers/hierarchy.py` | `src/core/managers/hierarchy.ts` | Implemented | `test/integration/hierarchy.test.ts` |
| `kicad_sch_api/core/connectivity.py` | `src/connectivity/analyzer.ts` | Implemented (simplified intersection logic) | `test/integration/connectivity.test.ts` |
| `kicad_sch_api/geometry/*` | `src/geometry/*` | Implemented | `test/integration/geometry.test.ts` |
| `kicad_sch_api/library/cache.py` | `src/library/cache.ts` | Implemented | `test/integration/library.test.ts` |
| `kicad_sch_api/symbols/*` | `src/library/*` | Partial (no explicit validators/resolver equivalents) | `test/integration/library.test.ts` |
| `kicad_sch_api/validation/erc.py` | `src/validation/erc.ts` | Implemented | `test/integration/erc.test.ts` |
| `kicad_sch_api/validation/pin_matrix.py` | `src/validation/pin-matrix.ts` | Implemented | `test/integration/erc.test.ts` |
| `kicad_sch_api/bom/auditor.py` | `src/bom/auditor.ts` | Implemented | `test/integration/bom.test.ts` |
| `kicad_sch_api/discovery/search_index.py` | `src/discovery/search-index.ts` | Implemented (SQLite FTS5) | `test/integration/discovery.test.ts` |
| `kicad_sch_api/exporters/python_generator.py` | `src/exporters/python-generator.ts` | Implemented | `test/integration/exporter.test.ts` |
| `kicad_sch_api/cli/*` | `src/adapters/cli/commands/*` | Implemented | `test/integration/cli.test.ts` |
| `kicad_sch_api/mcp_server/*` | `src/adapters/mcp/*` | Implemented | `test/integration/mcp.test.ts` |
| `kicad_sch_api/parsers/*` | `src/core/schematic.ts` | Implemented (logic consolidated in schematic parser) | `test/integration/round-trip.test.ts` |
| `kicad_sch_api/utils/*` | `src/core/types.ts` + internal helpers | Partial (logging helpers not ported) | Not applicable |
| `kicad_sch_api/interfaces/*` | Not ported | Not required | Not applicable |

## Limitations and Decisions

Source docs:
- `https://github.com/circuit-synth/kicad-sch-api/blob/main/KNOWN_ISSUES.md`
- `https://github.com/circuit-synth/kicad-sch-api/blob/main/docs/KNOWN_LIMITATIONS.md`
- `https://github.com/circuit-synth/kicad-sch-api/blob/main/docs/ROUNDTRIP_FIDELITY_ISSUES.md`

Decisions are categorized as:
- **Match**: Keep the same behavior or limitation.
- **Improve**: TS fixes or exceeds Python behavior.
- **Defer**: Acknowledge the gap and track it for later.

### Known Issues (Python)

1. **Multi-unit symbol detection (`add_all_units=True`)**
   - **Decision**: Defer.
   - **TS status**: TS supports explicit `unit` placement, but does not include an `add_all_units` helper yet.

2. **Grid snapping test tolerance**
   - **Decision**: Match.
   - **TS status**: Tests use grid-aligned coordinates; snapped values are expected.

### Known Limitations (Python)

1. **Component rotation in bounding box calculations**
   - **Decision**: Improve.
   - **TS status**: `getComponentBoundingBox` applies rotation and mirroring in `src/geometry/symbol-bbox.ts`.

2. **Pin position rotation and symbol offsets**
   - **Decision**: Improve.
   - **TS status**: Connectivity transforms pin positions with rotation/mirroring in `src/connectivity/analyzer.ts`.

3. **Simplified wire connectivity analysis**
   - **Decision**: Match.
   - **TS status**: Connectivity uses endpoint/junction unioning without advanced intersection detection.

### Round-Trip Fidelity Issues (Python)

1. **Pin UUIDs not preserved**
   - **Decision**: Improve.
   - **TS status**: Pin UUIDs are parsed and preserved; loaded schematics retain the original S-expression.

2. **Component text positioning (user concern)**
   - **Decision**: Defer.
   - **TS status**: Existing schematics preserve positions; newly created symbols use default property offsets and may not match complex library placement.

## Open Parity Gaps

- `add_all_units` convenience helper for multi-unit symbols is not implemented.
- Advanced wire intersection detection is not implemented.
- Logging/telemetry utilities from Python are not ported (not required for core functionality).
