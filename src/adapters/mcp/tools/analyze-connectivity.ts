// src/adapters/mcp/tools/analyze-connectivity.ts

import { getCurrentSchematic } from "./manage-schematic";
import { ConnectivityAnalyzer } from "../../../connectivity/analyzer";
import { getSymbolCache } from "../../../library/cache";

export const analyzeConnectivityTool = {
  name: "analyze_connectivity",
  description: "Analyze net connectivity in the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["nets", "unconnected", "check_pin"],
        description: "Analysis action to perform",
      },
      component: {
        type: "string",
        description: "Component reference for pin check",
      },
      pin: {
        type: "string",
        description: "Pin number/name for connection check",
      },
    },
    required: ["action"],
  },
};

export async function handleAnalyzeConnectivity(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded. Use manage_schematic first.");

  const { action, component, pin } = args;
  const analyzer = new ConnectivityAnalyzer(sch, getSymbolCache());

  switch (action) {
    case "nets":
      const nets = analyzer.analyzeNets();
      return {
        count: nets.length,
        nets: nets.map((net) => ({
          name: net.name,
          pinCount: net.pins.length,
          wireCount: net.wireCount,
        })),
      };

    case "unconnected":
      const unconnected = analyzer.findUnconnectedPins();
      return {
        count: unconnected.length,
        pins: unconnected.map((p) => ({
          component: p.reference,
          pin: p.pin,
          position: p.position,
        })),
      };

    case "check_pin":
      if (!component || !pin) {
        throw new Error("component and pin required for check_pin");
      }
      const result = analyzer.checkPinConnection(component, pin);
      return {
        component,
        pin,
        connected: result.connected,
        netName: result.netName,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
