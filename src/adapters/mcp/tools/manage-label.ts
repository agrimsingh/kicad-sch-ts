// src/adapters/mcp/tools/manage-label.ts

import { getCurrentSchematic } from "./manage-schematic";

export const manageLabelTool = {
  name: "manage_label",
  description: "Add, remove, or list labels in the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "remove", "list"],
        description: "Action to perform",
      },
      type: {
        type: "string",
        enum: ["local", "global", "hierarchical"],
        description: "Type of label",
      },
      text: {
        type: "string",
        description: "Label text",
      },
      position: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        description: "Position of the label",
      },
      rotation: {
        type: "number",
        description: "Rotation in degrees",
      },
      justify: {
        type: "object",
        properties: {
          horizontal: {
            type: "string",
            enum: ["left", "center", "right"],
          },
          vertical: {
            type: "string",
            enum: ["top", "center", "bottom"],
          },
          mirror: {
            type: "boolean",
          },
        },
        description: "Text justification",
      },
    },
    required: ["action"],
  },
};

export async function handleManageLabel(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const { action, type, text, position, rotation, justify } = args;

  switch (action) {
    case "add":
      if (!text || !position) {
        throw new Error("text and position are required for add");
      }
      const labelType = type || "local";
      const label = sch.labels.add({
        text,
        position,
        rotation: rotation || 0,
        type: labelType,
        justify,
      });
      return {
        success: true,
        message: `Added ${labelType} label "${text}" at (${position.x}, ${position.y})`,
        uuid: label.uuid,
      };

    case "remove":
      if (!text) throw new Error("text required for remove");
      const removed = sch.labels.remove(text);
      return {
        success: removed,
        message: removed
          ? `Removed label "${text}"`
          : `Label not found: "${text}"`,
      };

    case "list":
      const labels: Array<{text: string; labelType: string; position: any; rotation: number}> = [];
      
      // Local labels
      for (const l of sch.labels) {
        labels.push({
          text: l.text,
          labelType: "local",
          position: l.position,
          rotation: l.rotation,
        });
      }
      
      // Global labels
      for (const l of sch.globalLabels) {
        labels.push({
          text: l.text,
          labelType: "global",
          position: l.position,
          rotation: l.rotation,
        });
      }
      
      // Hierarchical labels
      for (const l of sch.hierarchicalLabels) {
        labels.push({
          text: l.text,
          labelType: "hierarchical",
          position: l.position,
          rotation: l.rotation,
        });
      }
      
      return { labels };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
