// src/adapters/mcp/tools/run-erc.ts

import { getCurrentSchematic } from "./manage-schematic";
import { ElectricalRulesChecker } from "../../../validation/erc";

export const runErcTool = {
  name: "run_erc",
  description: "Run Electrical Rules Check on the current schematic",
  inputSchema: {
    type: "object",
    properties: {
      strict: {
        type: "boolean",
        description: "Treat warnings as errors",
        default: false,
      },
    },
  },
};

export async function handleRunErc(args: any): Promise<any> {
  const sch = getCurrentSchematic();
  if (!sch) throw new Error("No schematic loaded");

  const checker = new ElectricalRulesChecker(sch, {
    treatWarningsAsErrors: args.strict || false,
  });

  const result = checker.check();

  return {
    passed: result.passed,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    violations: result.violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
    })),
  };
}
