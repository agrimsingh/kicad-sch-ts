// src/adapters/mcp/tools/manage-component.ts

import { getCurrentSchematic } from "./manage-schematic";

export const manageComponentTool = {
  name: "manage_component",
  description: "Add, modify, or remove components in the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "modify", "remove", "list", "get"],
        description: "Action to perform",
      },
      reference: {
        type: "string",
        description: "Component reference (e.g., R1, C1)",
      },
      lib_id: {
        type: "string",
        description: "Library ID for new component (e.g., Device:R)",
      },
      value: {
        type: "string",
        description: "Component value",
      },
      position: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        description: "Position in schematic coordinates",
      },
      rotation: {
        type: "number",
        description: "Rotation in degrees (0, 90, 180, 270)",
      },
      footprint: {
        type: "string",
        description: "Footprint reference",
      },
      properties: {
        type: "object",
        description: "Additional properties to set",
      },
    },
    required: ["action"],
  },
};

export async function handleManageComponent(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const {
    action,
    reference,
    lib_id,
    value,
    position,
    rotation,
    footprint,
    properties,
  } = args;

  switch (action) {
    case "add":
      if (!lib_id || !reference || !value || !position) {
        throw new Error(
          "lib_id, reference, value, and position are required for add"
        );
      }
      const newComp = sch.components.add({
        libId: lib_id,
        reference,
        value,
        position,
        rotation,
        footprint,
        properties,
      });
      return {
        success: true,
        message: `Added component ${reference}`,
        uuid: newComp.uuid,
      };

    case "modify":
      if (!reference) throw new Error("reference required for modify");
      const comp = sch.components.get(reference);
      if (!comp) throw new Error(`Component not found: ${reference}`);

      if (value !== undefined) comp.value = value;
      if (footprint !== undefined) comp.footprint = footprint;
      if (properties) {
        for (const [key, val] of Object.entries(properties)) {
          comp.setProperty(key, val as string);
        }
      }
      return {
        success: true,
        message: `Modified component ${reference}`,
      };

    case "remove":
      if (!reference) throw new Error("reference required for remove");
      const removed = sch.components.remove(reference);
      return {
        success: removed,
        message: removed
          ? `Removed component ${reference}`
          : `Component not found: ${reference}`,
      };

    case "list":
      return {
        components: sch.components.map((c) => ({
          reference: c.reference,
          libId: c.libId,
          value: c.value,
          position: c.position,
        })),
      };

    case "get":
      if (!reference) throw new Error("reference required for get");
      const getComp = sch.components.get(reference);
      if (!getComp) throw new Error(`Component not found: ${reference}`);
      return {
        reference: getComp.reference,
        libId: getComp.libId,
        value: getComp.value,
        position: getComp.position,
        rotation: getComp.rotation,
        footprint: getComp.footprint,
        properties: getComp.properties,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
