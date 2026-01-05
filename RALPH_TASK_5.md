---
task: "kicad-sch-ts Parity and Excellence Roadmap"
test_command: "npm test"
completion_criteria:
  - Round-trip fidelity is correct for load → save with no changes.
  - Core parity gaps vs Python are closed or explicitly documented as TS-specific.
  - CLI/MCP and public API parity items are implemented and tested.
  - README includes a clear parity + limitations section.
max_iterations: 250
---

# Task: kicad-sch-ts Parity and Excellence Roadmap

This task list translates the parity proposal into actionable steps for execution and tracking.

---

## 0. Parity Target Definition (Foundational)

- [x] Build a parity matrix (Python module → TS module → status → tests).
- [x] Summarize Python limitations from:
  - [x] `tmp_kicad-sch-api/KNOWN_ISSUES.md`
  - [x] `tmp_kicad-sch-api/docs/KNOWN_LIMITATIONS.md`
  - [x] `tmp_kicad-sch-api/docs/ROUNDTRIP_FIDELITY_ISSUES.md`
- [x] Decide per limitation: match, improve, or defer in TS.
- [x] Add a “Parity + Limitations” section to `README.md`.
- [x] Create a short tracking doc for parity decisions (new file, e.g. `PARITY.md`).

**Acceptance notes**
- Parity matrix links to concrete TS file paths and tests.
- Each limitation has a decision and rationale.

---

## 1. Round-Trip Fidelity (Highest Priority)

- [x] Implement serialization for in-memory changes (currently `format()` ignores edits).
  - Target: `src/core/schematic.ts` and related collections.
  - Decide: update `_sexp` incrementally vs rebuild from collections.
- [x] Preserve pin UUIDs on load/save.
  - Target: `src/core/schematic.ts` (symbol parsing/building).
- [x] Preserve property effects and label effects (including justification).
  - Target: `src/core/schematic.ts`, `src/core/types.ts`, `src/core/collections/label.ts`.
- [x] Ensure `lib_symbols` is persisted or properly reconstructed for new schematics.
  - Target: `src/core/schematic.ts`, `src/library/cache.ts`.
- [x] Add round-trip golden tests for:
  - [x] pin UUID preservation
  - [x] property preservation
  - [x] text effects preservation
  - [x] label rotations/justification
  - Suggested test areas: `test/integration/round-trip.test.ts` and `tests/reference_kicad_projects/*`.

**Acceptance notes**
- Load → save with no edits produces identical output for reference fixtures.
- Pin UUIDs preserved in symbols.
- Effects (font, justify, hide) persist across save.

---

## 2. Connectivity and Hierarchy Parity

- [x] Port hierarchical connectivity:
  - [x] sheet pin ↔ hierarchical label connections
  - [x] global labels across sheets
  - [x] power symbol connectivity
- [x] Align data structures to support hierarchical nets.
- [x] Extend hierarchy tools:
  - [x] hierarchy tree with sheet reuse tracking
  - [x] sheet pin validation parity
  - [x] cross-sheet signal tracing
- [x] Add integration tests for hierarchical connectivity.
  - Target: `test/integration/hierarchy.test.ts`, `test/integration/connectivity.test.ts`.

**Targets**
- `src/connectivity/analyzer.ts`
- `src/core/managers/hierarchy.ts`
- `src/core/types.ts`

**Acceptance notes**
- Hierarchical labels connect across sheets.
- Global labels connect across all sheets.
- Power symbols connect implicitly.

---

## 3. Symbol Library and Pin Semantics

- [x] Add symbol inheritance resolution (`extends` support).
- [x] Add symbol validation utilities (inheritance chain checks).
- [x] Expose pin enumeration helpers (`listPins`, `showPins` or TS equivalent).
- [x] Align symbol cache behavior with Python (unit count, power symbols, etc.).
- [x] Add tests for symbol inheritance and pin enumeration.
  - Target: `test/unit/symbols/*.test.ts`.

**Targets**
- `src/library/cache.ts`
- `src/library/index.ts`
- `src/core/types.ts`

**Acceptance notes**
- Symbols that extend others resolve correctly.
- Pin enumeration helpers return correct data for known symbols.

---

## 4. Component Property Positioning

- [x] Port property positioning logic (library-derived offsets).
- [x] Add TS fallbacks for common symbols if library data missing.
- [x] Add tests for property positioning reference schematics.
  - Suggested fixtures: `tests/reference_kicad_projects/property_positioning_*`.

**Targets**
- `src/core/collections/component.ts`
- `src/library/cache.ts`
- `src/core/types.ts`

**Acceptance notes**
- Property placement matches KiCad reference fixtures.

---

## 5. Graphics and Schematic Elements

- [x] Add parsers/serializers for:
  - [x] polyline
  - [x] arc
  - [x] circle
  - [x] bezier
  - [x] image
- [x] Add collections for new graphics elements where appropriate.
- [x] Add tests for graphics round-trip fidelity.

**Targets**
- `src/core/schematic.ts`
- `src/core/collections/graphics.ts`
- `src/core/types.ts`

**Acceptance notes**
- Graphics elements survive load → save with no diffs.

---

## 6. Multi-Unit Components

- [x] Add multi-unit group helper API (add_all_units behavior).
- [x] Fix unit detection in symbol parsing (unit count and names).
- [x] Add multi-unit tests and fixtures.
  - Suggested fixtures: `tests/reference_kicad_projects/multi_unit_tl072/*`.

**Targets**
- `src/core/collections/component.ts`
- `src/library/cache.ts`

**Acceptance notes**
- `add_all_units` adds all units with correct naming and positions.

---

## 7. API Ergonomics (PR-Driven Enhancements)

- [x] Add label justification support to add_label.
- [x] Add `hasProperty()` to Component.
- [x] Add find/replace for signal names.
- [x] Add optional coordinate system config (standard Y-axis option).
- [x] Add sym-lib-table parsing for third-party libraries.

**Targets**
- `src/core/collections/label.ts`
- `src/core/collections/component.ts`
- `src/core/config.ts`
- `src/library/cache.ts`
- `src/discovery/index.ts` (if needed)

**Acceptance notes**
- APIs are documented with examples in `README.md`.

---

## 8. CLI and MCP Parity

- [x] Audit TS CLI output and behavior vs Python CLI.
- [x] Align MCP tools and error models with Python MCP server.
- [x] Add integration tests for CLI and MCP parity.
  - Target: `test/integration/cli.test.ts`, `test/integration/mcp.test.ts`.

**Targets**
- `src/adapters/cli/commands/*`
- `src/adapters/mcp/*`

**Acceptance notes**
- CLI and MCP commands match Python behaviors for common flows.

---

## 9. Documentation and Positioning

- [x] Document TS-specific advantages (fidelity, performance, ergonomics).
- [x] Provide Python→TS migration notes.
- [x] Add “recipes” for common workflows (BOM, ERC, connectivity).
  - Target: `README.md` and new docs if needed.

---

## 10. Quality Gates

- [x] Establish a parity test suite that must pass before release.
- [x] Add CI checks for round-trip fidelity on reference projects.
- [x] Track regressions in a dedicated CHANGELOG section.

**Acceptance notes**
- CI fails if parity test suite fails.
- CHANGELOG notes parity regressions explicitly.
