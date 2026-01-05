// src/adapters/mcp/tools/discover-pins.ts

import { getCurrentSchematic } from "./manage-schematic";
import { ConnectivityAnalyzer } from "../../../connectivity/analyzer";

export const discoverPinsTool = {
  name: "discover_pins",
  description: "Discover pins at a specific position or for a component",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["at_position", "for_component"],
        description: "Discovery action to perform",
      },
      position: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        description: "Position to check for pins",
      },
      component: {
        type: "string",
        description: "Component reference to get pins for",
      },
    },
    required: ["action"],
  },
};

export async function handleDiscoverPins(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const { action, position, component } = args;
  const analyzer = new ConnectivityAnalyzer(sch);

  switch (action) {
    case "at_position":
      if (!position) {
        throw new Error("position required for at_position");
      }
      const pinsAtPos = analyzer.getPinsAtPosition(position);
      return {
        count: pinsAtPos.length,
        pins: pinsAtPos.map((p) => ({
          component: p.reference,
          pin: p.pin,
          position: p.position,
        })),
      };

    case "for_component":
      if (!component) {
        throw new Error("component required for for_component");
      }
      const comp = sch.components.get(component);
      if (!comp) {
        throw new Error(`Component not found: ${component}`);
      }
      // Get pin information from component data (pin number -> uuid map)
      const pinData = comp.data.pins;
      const pins: Array<{ number: string; uuid: string }> = [];
      for (const [number, uuid] of pinData) {
        pins.push({ number, uuid });
      }
      return {
        component,
        count: pins.length,
        pins,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
