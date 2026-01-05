// src/validation/erc.ts

import { Schematic } from "../core/schematic";
import { PinType } from "../core/types";

export enum ERCSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

export interface ERCViolation {
  code: string;
  severity: ERCSeverity;
  message: string;
  location?: {
    sheet?: string;
    element?: string;
    position?: { x: number; y: number };
  };
}

export interface ERCResult {
  violations: ERCViolation[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passed: boolean;
}

export interface ERCConfig {
  checkPinConflicts: boolean;
  checkUnconnectedPins: boolean;
  checkDuplicateReferences: boolean;
  checkOffGridPins: boolean;
  checkMissingFootprints: boolean;
  checkMissingValues: boolean;
  treatWarningsAsErrors: boolean;
  gridSize: number;
}

export const DEFAULT_ERC_CONFIG: ERCConfig = {
  checkPinConflicts: true,
  checkUnconnectedPins: true,
  checkDuplicateReferences: true,
  checkOffGridPins: true,
  checkMissingFootprints: false,
  checkMissingValues: false,
  treatWarningsAsErrors: false,
  gridSize: 1.27,
};

export class ElectricalRulesChecker {
  private schematic: Schematic;
  private config: ERCConfig;

  constructor(schematic: Schematic, config?: Partial<ERCConfig>) {
    this.schematic = schematic;
    this.config = { ...DEFAULT_ERC_CONFIG, ...config };
  }

  check(): ERCResult {
    const violations: ERCViolation[] = [];

    if (this.config.checkDuplicateReferences) {
      violations.push(...this.checkDuplicateReferences());
    }

    if (this.config.checkOffGridPins) {
      violations.push(...this.checkOffGridPins());
    }

    if (this.config.checkMissingFootprints) {
      violations.push(...this.checkMissingFootprints());
    }

    if (this.config.checkMissingValues) {
      violations.push(...this.checkMissingValues());
    }

    // Also check for basic issues
    violations.push(...this.checkPowerSymbolConnections());
    violations.push(...this.checkFloatingLabels());

    const errorCount = violations.filter(
      (v) => v.severity === ERCSeverity.ERROR
    ).length;
    const warningCount = violations.filter(
      (v) => v.severity === ERCSeverity.WARNING
    ).length;
    const infoCount = violations.filter(
      (v) => v.severity === ERCSeverity.INFO
    ).length;

    return {
      violations,
      errorCount,
      warningCount,
      infoCount,
      passed: this.config.treatWarningsAsErrors
        ? errorCount + warningCount === 0
        : errorCount === 0,
    };
  }

  private checkDuplicateReferences(): ERCViolation[] {
    const violations: ERCViolation[] = [];
    const seen = new Map<string, string>();

    for (const component of this.schematic.components) {
      const ref = component.reference;

      // Skip power symbols and special references
      if (ref.startsWith("#") || ref === "") continue;

      if (seen.has(ref)) {
        violations.push({
          code: "DUPLICATE_REFERENCE",
          severity: ERCSeverity.ERROR,
          message: `Duplicate reference designator: ${ref}`,
          location: { element: component.uuid },
        });
      } else {
        seen.set(ref, component.uuid);
      }
    }

    return violations;
  }

  private checkOffGridPins(): ERCViolation[] {
    const violations: ERCViolation[] = [];
    const gridSize = this.config.gridSize;

    for (const component of this.schematic.components) {
      const pos = component.position;
      const snapX = Math.round(pos.x / gridSize) * gridSize;
      const snapY = Math.round(pos.y / gridSize) * gridSize;

      if (Math.abs(pos.x - snapX) > 0.01 || Math.abs(pos.y - snapY) > 0.01) {
        violations.push({
          code: "OFF_GRID",
          severity: ERCSeverity.WARNING,
          message: `Component ${component.reference} is off-grid`,
          location: { element: component.uuid, position: pos },
        });
      }
    }

    // Check wire endpoints
    for (const wire of this.schematic.wires) {
      for (const pt of wire.points) {
        const snapX = Math.round(pt.x / gridSize) * gridSize;
        const snapY = Math.round(pt.y / gridSize) * gridSize;

        if (Math.abs(pt.x - snapX) > 0.01 || Math.abs(pt.y - snapY) > 0.01) {
          violations.push({
            code: "OFF_GRID_WIRE",
            severity: ERCSeverity.WARNING,
            message: `Wire endpoint at (${pt.x}, ${pt.y}) is off-grid`,
            location: { element: wire.uuid, position: pt },
          });
        }
      }
    }

    return violations;
  }

  private checkMissingFootprints(): ERCViolation[] {
    const violations: ERCViolation[] = [];

    for (const component of this.schematic.components) {
      // Skip power symbols and special references
      if (component.reference.startsWith("#")) continue;
      if (!component.inBom) continue;

      if (!component.footprint || component.footprint.trim() === "") {
        violations.push({
          code: "MISSING_FOOTPRINT",
          severity: ERCSeverity.WARNING,
          message: `Component ${component.reference} has no footprint assigned`,
          location: { element: component.uuid },
        });
      }
    }

    return violations;
  }

  private checkMissingValues(): ERCViolation[] {
    const violations: ERCViolation[] = [];

    for (const component of this.schematic.components) {
      // Skip power symbols
      if (component.reference.startsWith("#")) continue;

      const value = component.value;
      if (!value || value.trim() === "" || value === "~") {
        violations.push({
          code: "MISSING_VALUE",
          severity: ERCSeverity.INFO,
          message: `Component ${component.reference} has no value`,
          location: { element: component.uuid },
        });
      }
    }

    return violations;
  }

  private checkPowerSymbolConnections(): ERCViolation[] {
    // Power symbols should be connected to wires
    const violations: ERCViolation[] = [];

    // This would require connectivity analysis to implement fully
    // For now, return empty (connectivity check would handle this)

    return violations;
  }

  private checkFloatingLabels(): ERCViolation[] {
    const violations: ERCViolation[] = [];

    // Check if labels are near wire endpoints
    for (const label of this.schematic.labels) {
      const pos = label.position;
      let connected = false;

      for (const wire of this.schematic.wires) {
        for (const pt of wire.points) {
          if (
            Math.abs(pt.x - pos.x) < 0.01 &&
            Math.abs(pt.y - pos.y) < 0.01
          ) {
            connected = true;
            break;
          }
        }
        if (connected) break;
      }

      if (!connected) {
        violations.push({
          code: "FLOATING_LABEL",
          severity: ERCSeverity.WARNING,
          message: `Label "${label.text}" may not be connected to a wire`,
          location: { element: label.uuid, position: pos },
        });
      }
    }

    return violations;
  }

  /**
   * Check for a specific violation code in results.
   */
  hasViolation(result: ERCResult, code: string): boolean {
    return result.violations.some((v) => v.code === code);
  }

  /**
   * Get violations of a specific severity.
   */
  getViolationsBySeverity(
    result: ERCResult,
    severity: ERCSeverity
  ): ERCViolation[] {
    return result.violations.filter((v) => v.severity === severity);
  }

  /**
   * Get a summary string of the ERC result.
   */
  getSummary(result: ERCResult): string {
    const parts: string[] = [];

    if (result.errorCount > 0) {
      parts.push(`${result.errorCount} error(s)`);
    }
    if (result.warningCount > 0) {
      parts.push(`${result.warningCount} warning(s)`);
    }
    if (result.infoCount > 0) {
      parts.push(`${result.infoCount} info(s)`);
    }

    if (parts.length === 0) {
      return "ERC passed with no issues";
    }

    return `ERC ${result.passed ? "passed" : "failed"}: ${parts.join(", ")}`;
  }
}
