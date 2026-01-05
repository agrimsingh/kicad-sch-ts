// src/adapters/mcp/tools/manage-schematic.ts

import { Schematic } from "../../../core/schematic";

export const manageSchematicTool = {
  name: "manage_schematic",
  description: "Create, load, or save KiCAD schematic files",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "load", "save", "info"],
        description: "Action to perform",
      },
      path: {
        type: "string",
        description: "File path for load/save operations",
      },
      title: {
        type: "string",
        description: "Title for new schematic (create action)",
      },
    },
    required: ["action"],
  },
};

// In-memory schematic storage for the session
let currentSchematic: Schematic | null = null;

export async function handleManageSchematic(args: any): Promise<any> {
  const { action, path, title } = args;

  switch (action) {
    case "create":
      currentSchematic = Schematic.create(title || "Untitled");
      return {
        success: true,
        message: `Created new schematic: ${title || "Untitled"}`,
        components: 0,
        wires: 0,
      };

    case "load":
      if (!path) throw new Error("Path required for load action");
      currentSchematic = Schematic.load(path);
      return {
        success: true,
        message: `Loaded schematic: ${path}`,
        title: currentSchematic.title,
        components: currentSchematic.components.length,
        wires: currentSchematic.wires.length,
        labels: currentSchematic.labels.length,
      };

    case "save":
      if (!currentSchematic) throw new Error("No schematic loaded");
      if (!path) throw new Error("Path required for save action");
      currentSchematic.save(path);
      return {
        success: true,
        message: `Saved schematic to: ${path}`,
      };

    case "info":
      if (!currentSchematic) throw new Error("No schematic loaded");
      return {
        title: currentSchematic.title,
        components: currentSchematic.components.length,
        wires: currentSchematic.wires.length,
        labels: currentSchematic.labels.length,
        junctions: currentSchematic.junctions.length,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export function getCurrentSchematic(): Schematic | null {
  return currentSchematic;
}

export function setCurrentSchematic(sch: Schematic): void {
  currentSchematic = sch;
}
