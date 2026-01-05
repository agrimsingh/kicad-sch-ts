// src/adapters/mcp/tools/analyze-hierarchy.ts

import { getCurrentSchematic } from "./manage-schematic";
import { HierarchyManager, HierarchyNode } from "../../../core/managers/hierarchy";

export const analyzeHierarchyTool = {
  name: "analyze_hierarchy",
  description: "Analyze hierarchical structure of the schematic",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["tree", "validate", "sheets", "components"],
        description: "Analysis action to perform",
      },
      path: {
        type: "string",
        description: "Sheet path for specific sheet operations",
      },
    },
    required: ["action"],
  },
};

export async function handleAnalyzeHierarchy(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const { action } = args;
  const manager = new HierarchyManager(sch);

  switch (action) {
    case "tree":
      const tree = manager.buildHierarchyTree();
      return {
        tree: formatHierarchyNode(tree),
      };

    case "validate":
      const validation = manager.validateSheetPins();
      return {
        valid: validation.valid,
        errors: validation.errors,
      };

    case "sheets":
      const sheets = manager.getAllSheets();
      return {
        count: sheets.length,
        sheets: sheets.map((s) => ({
          name: s.name,
          path: s.path,
          filename: s.filename,
        })),
      };

    case "components":
      const components = manager.getAllComponents();
      return {
        count: components.length,
        components: components.map((c) => ({
          reference: c.reference,
          libId: c.libId,
          path: c.path,
        })),
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function formatHierarchyNode(node: HierarchyNode): any {
  return {
    name: node.name,
    path: node.path,
    filename: node.filename,
    level: node.level,
    children: node.children.map(formatHierarchyNode),
  };
}
