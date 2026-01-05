// src/core/managers/hierarchy.ts

import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve, basename } from "path";
import { Schematic } from "../schematic";
import { Sheet, SheetPin, HierarchicalLabel } from "../types";
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
  private cache: Map<string, Schematic> = new Map();
  private tree: HierarchyNode;

  constructor(schematic: Schematic) {
    this.rootSchematic = schematic;
    this.rootPath = schematic.fileIO?.getFilePath() || "";
    this.tree = this.buildHierarchyTree();
  }

  /**
   * Build the hierarchy tree from the root schematic.
   */
  buildHierarchyTree(loadSubsheets: boolean = false): HierarchyNode {
    const rootNode: HierarchyNode = {
      path: "/",
      name: this.rootSchematic.title || basename(this.rootPath, ".kicad_sch"),
      filename: this.rootPath,
      schematic: this.rootSchematic,
      children: [],
      sheetPins: [],
      level: 0,
    };

    this.buildNodeChildren(rootNode, loadSubsheets);
    this.tree = rootNode;
    return rootNode;
  }

  private buildNodeChildren(node: HierarchyNode, loadSubsheets: boolean): void {
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

      if (loadSubsheets && existsSync(childPath)) {
        try {
          const childSchematic = this.loadSubsheet(childPath);
          childNode.schematic = childSchematic;
          this.buildNodeChildren(childNode, loadSubsheets);
        } catch (e) {
          console.error(`Failed to load subsheet ${childPath}:`, e);
        }
      }

      node.children.push(childNode);
    }
  }

  /**
   * Load a subsheet schematic.
   */
  loadSubsheet(filePath: string): Schematic {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const schematic = Schematic.load(filePath);
    this.cache.set(filePath, schematic);
    return schematic;
  }

  /**
   * Get the hierarchy tree.
   */
  getTree(): HierarchyNode {
    return this.tree;
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

    traverse(this.tree);
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

    return traverse(this.tree);
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

    traverse(this.tree, 0);
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

    validateNode(this.tree);

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

    traverse(this.tree);
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

    traverse(this.tree);
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

    traverse(this.tree);
    return count;
  }
}
