// src/core/managers/hierarchy.ts

import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve, basename } from "path";
import { Schematic } from "../schematic";
import {
  Sheet,
  SheetPin,
  HierarchicalLabel,
  Point,
  SheetPinConnection,
  SignalPath,
} from "../types";
import { HierarchyError } from "../exceptions";
import { ConnectivityAnalyzer } from "../../connectivity/analyzer";
import { createLogger, formatError } from "../logger";

export interface HierarchyNode {
  path: string;
  name: string;
  filename: string;
  schematic?: Schematic;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  sheetPins: SheetPin[];
  level: number;
  reuseKey?: string;
  reuseIndex?: number;
  isReuse?: boolean;
}

export interface SheetPinValidation {
  valid: boolean;
  errors: SheetPinError[];
}

export interface SheetPinError {
  sheetPath: string;
  pinName: string;
  error: "missing_label" | "mismatched_direction" | "missing_pin";
  message: string;
}

export class HierarchyManager {
  private rootSchematic: Schematic;
  private rootPath: string;
  private _loadedSchematics: Map<string, Schematic> = new Map();
  private _hierarchyTree: HierarchyNode | null = null;
  private _reuseCounts: Map<string, number> = new Map();
  private _analyzers: Map<string, ConnectivityAnalyzer> = new Map();
  private logger = createLogger({ name: "hierarchy" });

  constructor(schematic: Schematic) {
    this.rootSchematic = schematic;
    this.rootPath = schematic.fileIO?.getFilePath() || "";
    this._loadedSchematics.set("/", schematic);
  }

  /**
   * Build the hierarchy tree from the root schematic.
   */
  buildHierarchyTree(loadSubsheets: boolean = true): HierarchyNode {
    const rootNode: HierarchyNode = {
      path: "/",
      name: this.rootSchematic.title || basename(this.rootPath, ".kicad_sch"),
      filename: this.rootPath,
      schematic: this.rootSchematic,
      children: [],
      sheetPins: [],
      level: 0,
      reuseKey: this.rootPath,
      reuseIndex: 0,
      isReuse: false,
    };

    this._hierarchyTree = rootNode;
    if (this.rootPath) {
      this._reuseCounts.set(this.rootPath, 1);
    }
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
        reuseKey: childPath,
        reuseIndex: this._reuseCounts.get(childPath) || 0,
        isReuse: (this._reuseCounts.get(childPath) || 0) > 0,
      };

      this._reuseCounts.set(childPath, (this._reuseCounts.get(childPath) || 0) + 1);

      if (existsSync(childPath)) {
        try {
          const childSchematic =
            this._loadedSchematics.get(childPath) || Schematic.load(childPath);
          this._loadedSchematics.set(childPath, childSchematic);
          childNode.schematic = childSchematic;
          this._buildTreeRecursive(childNode);
        } catch (e) {
          this.logger.error("Failed to load subsheet", {
            path: childPath,
            error: formatError(e),
          });
        }
      }
      node.children.push(childNode);
    }
  }

  /**
   * Flatten the hierarchy into a single schematic with all components.
   */
  flattenHierarchy(prefixReferences: boolean = true): Schematic {
    if (!this._hierarchyTree) this.buildHierarchyTree(true);

    const flatSchematic = Schematic.create("Flattened");

    this._flattenRecursive(
      this._hierarchyTree!,
      flatSchematic,
      prefixReferences,
      ""
    );
    return flatSchematic;
  }

  private _flattenRecursive(
    node: HierarchyNode,
    flatSchematic: Schematic,
    prefixReferences: boolean,
    prefix: string
  ): void {
    if (!node.schematic) return;

    const transformPoint = (p: Point, sheet: Sheet): Point => {
      return { x: p.x + sheet.position.x, y: p.y + sheet.position.y };
    };

    for (const component of node.schematic.components) {
      const newRef =
        prefixReferences && node.parent
          ? `${prefix}${component.reference}`
          : component.reference;
      // Skip if component with this reference already exists
      if (flatSchematic.components.get(newRef)) continue;

      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(component.position, sheetInstance)
        : component.position;

      flatSchematic.components.add({
        libId: component.libId,
        reference: newRef,
        value: component.value,
        position: pos,
        rotation: component.rotation,
        mirror: component.mirror,
        unit: component.unit,
        footprint: component.footprint,
        inBom: component.inBom,
        onBoard: component.onBoard,
      });
    }

    for (const wire of node.schematic.wires) {
      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const points = sheetInstance
        ? wire.points.map((p) => transformPoint(p, sheetInstance))
        : wire.points;
      flatSchematic.wires.add({ points, stroke: wire.stroke });
    }

    for (const label of node.schematic.labels) {
      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(label.position, sheetInstance)
        : label.position;
      flatSchematic.labels.add({
        text: label.text,
        position: pos,
        rotation: label.rotation,
        effects: label.effects,
      });
    }

    for (const junction of node.schematic.junctions) {
      const sheetInstance = node.parent?.schematic?.sheets.find(
        (s) => s.name.value === node.name
      );
      const pos = sheetInstance
        ? transformPoint(junction.position, sheetInstance)
        : junction.position;
      flatSchematic.junctions.add({
        position: pos,
        diameter: junction.diameter,
        color: junction.color,
      });
    }

    for (const child of node.children) {
      const sheet = node.schematic.sheets.find(
        (s) => s.name.value === child.name
      );
      if (sheet) {
        const childPrefix = prefixReferences
          ? `${prefix}${sheet.name.value}/`
          : prefix;
        this._flattenRecursive(
          child,
          flatSchematic,
          prefixReferences,
          childPrefix
        );
      }
    }
  }

  /**
   * Load a subsheet schematic.
   */
  loadSubsheet(filePath: string): Schematic {
    if (this._loadedSchematics.has(filePath)) {
      return this._loadedSchematics.get(filePath)!;
    }

    const schematic = Schematic.load(filePath);
    this._loadedSchematics.set(filePath, schematic);
    return schematic;
  }

  /**
   * Get the hierarchy tree.
   */
  getTree(): HierarchyNode {
    if (!this._hierarchyTree) {
      this.buildHierarchyTree();
    }
    return this._hierarchyTree!;
  }

  /**
   * Get all sheets in the hierarchy (flattened).
   */
  getAllSheets(): HierarchyNode[] {
    const result: HierarchyNode[] = [];

    const traverse = (node: HierarchyNode) => {
      result.push(node);
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this.getTree());
    return result;
  }

  /**
   * Get sheet at a specific hierarchy path.
   */
  getSheetByPath(path: string): HierarchyNode | undefined {
    const traverse = (node: HierarchyNode): HierarchyNode | undefined => {
      if (node.path === path) return node;
      for (const child of node.children) {
        const found = traverse(child);
        if (found) return found;
      }
      return undefined;
    };

    return traverse(this.getTree());
  }

  /**
   * Get maximum hierarchy depth.
   */
  getMaxDepth(): number {
    let maxDepth = 0;

    const traverse = (node: HierarchyNode, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    };

    traverse(this.getTree(), 0);
    return maxDepth;
  }

  /**
   * Validate sheet pins match hierarchical labels in subsheets.
   */
  validateSheetPins(): SheetPinValidation {
    const errors: SheetPinError[] = [];

    const validateNode = (node: HierarchyNode) => {
      if (!node.schematic) {
        for (const child of node.children) {
          validateNode(child);
        }
        return;
      }

      for (const child of node.children) {
        if (!child.schematic) continue;

        // Get hierarchical labels from child schematic
        const childLabels = new Map<string, HierarchicalLabel>();
        for (const label of child.schematic.hierarchicalLabels) {
          childLabels.set(label.text, label);
        }

        // Validate each sheet pin has a corresponding label
        for (const pin of child.sheetPins) {
          if (!childLabels.has(pin.name)) {
            errors.push({
              sheetPath: child.path,
              pinName: pin.name,
              error: "missing_label",
              message: `Sheet pin "${pin.name}" has no matching hierarchical label in subsheet`,
            });
          } else {
            const label = childLabels.get(pin.name)!;
            // Check direction compatibility
            if (pin.shape !== label.shape) {
              errors.push({
                sheetPath: child.path,
                pinName: pin.name,
                error: "mismatched_direction",
                message: `Sheet pin "${pin.name}" direction ${pin.shape} doesn't match label direction ${label.shape}`,
              });
            }
          }
        }

        // Check for orphan labels (labels without pins)
        for (const [labelName] of childLabels) {
          const hasPin = child.sheetPins.some((p) => p.name === labelName);
          if (!hasPin) {
            errors.push({
              sheetPath: child.path,
              pinName: labelName,
              error: "missing_pin",
              message: `Hierarchical label "${labelName}" has no corresponding sheet pin`,
            });
          }
        }

        validateNode(child);
      }
    };

    validateNode(this.getTree());

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getSheetPinConnections(): SheetPinConnection[] {
    const connections: SheetPinConnection[] = [];

    const traverse = (node: HierarchyNode) => {
      for (const child of node.children) {
        if (!child.schematic || !node.schematic) {
          traverse(child);
          continue;
        }

        for (const pin of child.sheetPins) {
          const label = child.schematic.hierarchicalLabels.find(
            (l) => l.text === pin.name
          );
          connections.push({
            sheetPath: child.path,
            pinName: pin.name,
            labelName: label?.text || pin.name,
            isMatch: Boolean(label) && label!.shape === pin.shape,
          });
        }

        traverse(child);
      }
    };

    traverse(this.getTree());
    return connections;
  }

  traceSignal(signalName: string): SignalPath | null {
    const paths = new Set<string>();
    const connections: SheetPinConnection[] = [];

    const addPathIfNetExists = (
      node: HierarchyNode,
      position: Point | null
    ) => {
      if (!node.schematic || !position) return;
      const analyzer = this.getAnalyzerForNode(node);
      if (!analyzer) return;
      if (analyzer.getNetAtPoint(position)) {
        paths.add(node.path);
      }
    };

    const traverse = (node: HierarchyNode) => {
      if (node.schematic) {
        for (const label of node.schematic.labels) {
          if (label.text === signalName) {
            addPathIfNetExists(node, label.position);
          }
        }
        for (const label of node.schematic.globalLabels) {
          if (label.text === signalName) {
            addPathIfNetExists(node, label.position);
          }
        }
        for (const label of node.schematic.hierarchicalLabels) {
          if (label.text === signalName) {
            addPathIfNetExists(node, label.position);
          }
        }
        for (const component of node.schematic.components) {
          const powerName = this.getPowerSymbolName(component.libId, component.value, component.reference);
          if (powerName === signalName) {
            addPathIfNetExists(node, component.position);
          }
        }
      }

      for (const child of node.children) {
        if (node.schematic && child.schematic) {
          for (const pin of child.sheetPins) {
            if (pin.name !== signalName) continue;
            const label = child.schematic.hierarchicalLabels.find(
              (l) => l.text === pin.name
            );
            const parentAnalyzer = this.getAnalyzerForNode(node);
            const childAnalyzer = this.getAnalyzerForNode(child);
            const parentNet = parentAnalyzer?.getNetAtPoint(pin.position);
            const childNet = label
              ? childAnalyzer?.getNetAtPoint(label.position)
              : undefined;

            connections.push({
              sheetPath: child.path,
              pinName: pin.name,
              labelName: label?.text || pin.name,
              isMatch: Boolean(label) && label!.shape === pin.shape,
            });

            if (parentNet && childNet) {
              paths.add(node.path);
              paths.add(child.path);
            }
          }
        }
        traverse(child);
      }
    };

    traverse(this.getTree());

    if (paths.size === 0 && connections.length === 0) {
      return null;
    }

    const pathList = Array.from(paths);
    return {
      signalName,
      startPath: pathList[0] || "/",
      endPath: pathList[pathList.length - 1] || "/",
      connections,
      sheetCrossings: connections.filter((c) => c.isMatch).length,
    };
  }

  traceSignals(): SignalPath[] {
    const signals = new Set<string>();

    const traverse = (node: HierarchyNode) => {
      if (node.schematic) {
        for (const label of node.schematic.labels) {
          signals.add(label.text);
        }
        for (const label of node.schematic.globalLabels) {
          signals.add(label.text);
        }
        for (const label of node.schematic.hierarchicalLabels) {
          signals.add(label.text);
        }
        for (const component of node.schematic.components) {
          const powerName = this.getPowerSymbolName(component.libId, component.value, component.reference);
          if (powerName) {
            signals.add(powerName);
          }
        }
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this.getTree());

    const paths: SignalPath[] = [];
    for (const signalName of signals) {
      const traced = this.traceSignal(signalName);
      if (traced) {
        paths.push(traced);
      }
    }
    return paths;
  }

  private getAnalyzerForNode(
    node: HierarchyNode
  ): ConnectivityAnalyzer | null {
    if (!node.schematic) return null;
    if (!this._analyzers.has(node.path)) {
      this._analyzers.set(node.path, new ConnectivityAnalyzer(node.schematic));
    }
    return this._analyzers.get(node.path) || null;
  }

  private getPowerSymbolName(
    libId: string,
    value: string,
    reference: string
  ): string | null {
    const normalized = libId.toLowerCase();
    if (normalized.startsWith("power:")) {
      return value || null;
    }
    if (reference.startsWith("#PWR")) {
      return value || null;
    }
    return null;
  }

  /**
   * Get all hierarchical labels in the entire hierarchy.
   */
  getAllHierarchicalLabels(): Array<{
    path: string;
    label: HierarchicalLabel;
  }> {
    const result: Array<{ path: string; label: HierarchicalLabel }> = [];

    const traverse = (node: HierarchyNode) => {
      if (node.schematic) {
        for (const label of node.schematic.hierarchicalLabels) {
          result.push({ path: node.path, label });
        }
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this.getTree());
    return result;
  }

  /**
   * Get all components in the entire hierarchy.
   */
  getAllComponents(): Array<{
    path: string;
    reference: string;
    libId: string;
  }> {
    const result: Array<{ path: string; reference: string; libId: string }> =
      [];

    const traverse = (node: HierarchyNode) => {
      if (node.schematic) {
        for (const component of node.schematic.components) {
          result.push({
            path: node.path,
            reference: component.reference,
            libId: component.libId,
          });
        }
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this.getTree());
    return result;
  }

  /**
   * Count total components in hierarchy.
   */
  getTotalComponentCount(): number {
    let count = 0;

    const traverse = (node: HierarchyNode) => {
      if (node.schematic) {
        count += node.schematic.components.length;
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this.getTree());
    return count;
  }
}
