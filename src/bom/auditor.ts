// src/bom/auditor.ts

import { Schematic } from "../core/schematic";
import { Component } from "../core/collections/component";
import { writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { createLogger, formatError } from "../core/logger";

export interface ComponentIssue {
  schematic: string;
  reference: string;
  value: string;
  footprint: string;
  libId: string;
  missingProperties: string[];
  existingProperties: Record<string, string>;
}

export interface BOMEntry {
  reference: string;
  value: string;
  footprint: string;
  libId: string;
  quantity: number;
  properties: Record<string, string>;
}

export class BOMPropertyAuditor {
  private logger = createLogger({ name: "bom-auditor" });

  auditSchematic(
    schematicPath: string,
    requiredProperties: string[],
    excludeDnp: boolean = false
  ): ComponentIssue[] {
    const issues: ComponentIssue[] = [];

    try {
      const sch = Schematic.load(schematicPath);

      for (const component of sch.components) {
        // Skip DNP (do not populate) components if requested
        if (excludeDnp && (!component.inBom || component.data.dnp)) {
          continue;
        }

        // Skip power symbols
        if (component.reference.startsWith("#")) {
          continue;
        }

        const missing: string[] = [];
        for (const prop of requiredProperties) {
          if (!component.getProperty(prop)) {
            missing.push(prop);
          }
        }

        if (missing.length > 0) {
          issues.push({
            schematic: schematicPath,
            reference: component.reference,
            value: component.value,
            footprint: component.footprint || "",
            libId: component.libId,
            missingProperties: missing,
            existingProperties: component.properties,
          });
        }
      }
    } catch (e) {
      this.logger.error("Error loading schematic", {
        path: schematicPath,
        error: formatError(e),
      });
    }

    return issues;
  }

  auditDirectory(
    directory: string,
    requiredProperties: string[],
    recursive: boolean = true,
    excludeDnp: boolean = false
  ): ComponentIssue[] {
    const issues: ComponentIssue[] = [];
    const files = this.findSchematicFiles(directory, recursive);

    for (const file of files) {
      issues.push(
        ...this.auditSchematic(file, requiredProperties, excludeDnp)
      );
    }

    return issues;
  }

  private findSchematicFiles(directory: string, recursive: boolean): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isFile() && entry.name.endsWith(".kicad_sch")) {
          files.push(fullPath);
        } else if (recursive && entry.isDirectory()) {
          files.push(...this.findSchematicFiles(fullPath, recursive));
        }
      }
    } catch {
      // Directory not readable
    }

    return files;
  }

  generateCsvReport(issues: ComponentIssue[], outputPath: string): void {
    const headers = [
      "Schematic",
      "Reference",
      "Value",
      "Footprint",
      "LibID",
      "Missing Properties",
    ];
    const rows = issues.map((issue) => [
      issue.schematic,
      issue.reference,
      issue.value,
      issue.footprint,
      issue.libId,
      issue.missingProperties.join("; "),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    writeFileSync(outputPath, csv);
  }

  /**
   * Generate a simple BOM from a schematic file path.
   */
  generateBOM(
    schematicPath: string,
    excludeDnp: boolean = true
  ): BOMEntry[] {
    try {
      const sch = Schematic.load(schematicPath);
      return this.generateBOMFromSchematic(sch, excludeDnp);
    } catch (e) {
      this.logger.error("Error loading schematic", {
        path: schematicPath,
        error: formatError(e),
      });
      return [];
    }
  }

  /**
   * Generate a simple BOM from a Schematic object directly.
   */
  generateBOMFromSchematic(
    sch: Schematic,
    excludeDnp: boolean = true
  ): BOMEntry[] {
    const entries = new Map<string, BOMEntry>();

    for (const component of sch.components) {
      // Skip DNP components if requested
      if (excludeDnp && (!component.inBom || component.data.dnp)) {
        continue;
      }

      // Skip power symbols
      if (component.reference.startsWith("#")) {
        continue;
      }

      // Group by value + footprint + libId
      const key = `${component.value}|${component.footprint}|${component.libId}`;

      if (entries.has(key)) {
        const entry = entries.get(key)!;
        entry.quantity++;
        entry.reference += `, ${component.reference}`;
      } else {
        entries.set(key, {
          reference: component.reference,
          value: component.value,
          footprint: component.footprint || "",
          libId: component.libId,
          quantity: 1,
          properties: component.properties,
        });
      }
    }

    return Array.from(entries.values());
  }

  /**
   * Export BOM to CSV.
   */
  exportBOMToCsv(entries: BOMEntry[], outputPath: string): void {
    const headers = ["Reference", "Value", "Footprint", "LibID", "Quantity"];
    const rows = entries.map((e) => [
      e.reference,
      e.value,
      e.footprint,
      e.libId,
      e.quantity.toString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    writeFileSync(outputPath, csv);
  }
}
