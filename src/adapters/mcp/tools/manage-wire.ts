// src/adapters/mcp/tools/manage-wire.ts

import { getCurrentSchematic } from "./manage-schematic";

export const manageWireTool = {
  name: "manage_wire",
  description: "Add, remove, or list wires in the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "remove", "list"],
        description: "Action to perform",
      },
      start: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        description: "Start point of the wire",
      },
      end: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        description: "End point of the wire",
      },
      uuid: {
        type: "string",
        description: "Wire UUID for removal",
      },
    },
    required: ["action"],
  },
};

export async function handleManageWire(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const { action, start, end, uuid } = args;

  switch (action) {
    case "add":
      if (!start || !end) {
        throw new Error("start and end are required for add");
      }
      const wire = sch.wires.add({ start, end });
      return {
        success: true,
        message: `Added wire from (${start.x}, ${start.y}) to (${end.x}, ${end.y})`,
        uuid: wire.uuid,
      };

    case "remove":
      if (!uuid) throw new Error("uuid required for remove");
      const removed = sch.wires.remove(uuid);
      return {
        success: removed,
        message: removed
          ? `Removed wire with UUID ${uuid}`
          : `Wire not found with UUID ${uuid}`,
      };

    case "list":
      return {
        wires: sch.wires.map((w) => ({
          uuid: w.uuid,
          start: w.points[0],
          end: w.points[w.points.length - 1],
          pointCount: w.points.length,
        })),
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
