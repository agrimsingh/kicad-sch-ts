// src/core/managers/hierarchy.ts

import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve, basename } from "path";
import { Schematic } from "../schematic";
import {
  Sheet,
  SheetPin,
  HierarchicalLabel,
  Point,
} from "../types";
import { HierarchyError } from "../exceptions";

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
