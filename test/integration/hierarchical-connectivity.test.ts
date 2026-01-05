// test/integration/hierarchical-connectivity.test.ts

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import {
  Schematic,
  LabelType,
  HierarchicalLabelShape,
} from "../../src";
import { HierarchyManager } from "../../src/core/managers/hierarchy";

function createTempHierarchy(options: {
  globalLabel?: string;
  powerLabel?: string;
  reuseChild?: boolean;
}) {
  const dir = mkdtempSync(join(tmpdir(), "kicad-hier-"));
  const childPath = join(dir, "child.kicad_sch");
  const rootPath = join(dir, "root.kicad_sch");

  const child = Schematic.create("Child");
  if (options.globalLabel) {
    child.labels.add({
      text: options.globalLabel,
      position: { x: 10, y: 10 },
      type: LabelType.GLOBAL,
    });
  }
  if (options.powerLabel) {
    child.components.add({
      libId: `power:${options.powerLabel}`,
      reference: `#PWR${Math.floor(Math.random() * 1000)}`,
      value: options.powerLabel,
      position: { x: 20, y: 20 },
    });
  }
  child.save(childPath);

  const root = Schematic.create("Root");
  const sheet = root.sheets.add({
    position: { x: 0, y: 0 },
    size: { width: 40, height: 30 },
    name: "Child",
    filename: "child.kicad_sch",
  });
  root.sheets.markModified();

  if (options.reuseChild) {
    const sheet2 = root.sheets.add({
      position: { x: 50, y: 0 },
      size: { width: 40, height: 30 },
      name: "ChildReuse",
      filename: "child.kicad_sch",
    });
    root.sheets.markModified();
    sheet2.pins.push({
      uuid: randomUUID(),
      name: "REUSE",
      shape: HierarchicalLabelShape.PASSIVE,
      position: { x: 50, y: 10 },
      rotation: 0,
    });
  }

  if (options.globalLabel) {
    root.labels.add({
      text: options.globalLabel,
      position: { x: 5, y: 5 },
      type: LabelType.GLOBAL,
    });
  }
  if (options.powerLabel) {
    root.components.add({
      libId: `power:${options.powerLabel}`,
      reference: `#PWR${Math.floor(Math.random() * 1000)}`,
      value: options.powerLabel,
      position: { x: 15, y: 15 },
    });
  }

  root.save(rootPath);

  return { dir, rootPath, sheet };
}

describe("Hierarchical Connectivity", () => {
  it("connects sheet pins to hierarchical labels across sheets", () => {
    const sch = Schematic.load(
      "tests/reference_kicad_projects/connectivity/ps2_hierarchical_power/ps2_hierarchical_power.kicad_sch"
    );

    const manager = new HierarchyManager(sch);
    const connections = manager.getSheetPinConnections();
    const dataConnection = connections.find(
      (c) => c.pinName === "DATA" && c.isMatch
    );

    expect(dataConnection).toBeDefined();

    const trace = manager.traceSignal("DATA");
    expect(trace).toBeDefined();
    expect(trace?.sheetCrossings).toBeGreaterThan(0);
  });

  it("connects global labels across sheets", () => {
    const { dir, rootPath } = createTempHierarchy({ globalLabel: "VCC" });

    const sch = Schematic.load(rootPath);
    const manager = new HierarchyManager(sch);
    const trace = manager.traceSignal("VCC");

    const tree = manager.getTree();
    const childPath = tree.children[0]?.path;

    expect(trace).toBeDefined();
    expect(trace?.startPath).toBe("/");
    expect(trace?.endPath).toBe(childPath);

    rmSync(dir, { recursive: true, force: true });
  });

  it("connects power symbols implicitly across sheets", () => {
    const { dir, rootPath } = createTempHierarchy({ powerLabel: "VCC" });

    const sch = Schematic.load(rootPath);
    const manager = new HierarchyManager(sch);
    const trace = manager.traceSignal("VCC");

    const tree = manager.getTree();
    const childPath = tree.children[0]?.path;

    expect(trace).toBeDefined();
    expect(trace?.startPath).toBe("/");
    expect(trace?.endPath).toBe(childPath);

    rmSync(dir, { recursive: true, force: true });
  });

  it("tracks sheet reuse in hierarchy tree", () => {
    const { dir, rootPath } = createTempHierarchy({
      globalLabel: "VCC",
      reuseChild: true,
    });

    const sch = Schematic.load(rootPath);
    const manager = new HierarchyManager(sch);
    const tree = manager.getTree();

    const reuseNodes = tree.children.filter((child) => child.isReuse);
    expect(reuseNodes.length).toBeGreaterThanOrEqual(1);

    rmSync(dir, { recursive: true, force: true });
  });
});
