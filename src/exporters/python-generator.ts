// src/exporters/python-generator.ts

import { Schematic } from "../core/schematic";
import { Component } from "../core/collections/component";
import { Wire, Label, GlobalLabel, HierarchicalLabel } from "../core/types";
import { writeFileSync } from "fs";

export type TemplateStyle = "minimal" | "default" | "verbose" | "documented";

export class PythonCodeGenerator {
  private template: TemplateStyle;
  private formatCode: boolean;
  private addComments: boolean;

  constructor(
    template: TemplateStyle = "default",
    formatCode: boolean = true,
    addComments: boolean = true
  ) {
    this.template = template;
    this.formatCode = formatCode;
    this.addComments = addComments;
  }

  generate(
    schematic: Schematic,
    includeHierarchy: boolean = true,
    outputPath?: string
  ): string {
    const lines: string[] = [];

    lines.push("#!/usr/bin/env python3");
    lines.push('"""');
    lines.push(
      `Generated from: ${schematic.fileIO?.getFilePath() || "unknown"}`
    );
    lines.push(`Generated at: ${new Date().toISOString()}`);
    lines.push('"""');
    lines.push("");
    lines.push("import kicad_sch_api as ksa");
    lines.push("");

    const title = schematic.title || "Untitled";
    if (this.addComments) {
      lines.push("# Create schematic");
    }
    lines.push(`sch = ksa.create_schematic("${this.escapeString(title)}")`);
    lines.push("");

    if (schematic.components.length > 0) {
      if (this.addComments) {
        lines.push("# Add components");
      }
      for (const component of schematic.components) {
        lines.push(this.generateComponentCode(component));
      }
      lines.push("");
    }

    if (schematic.wires.length > 0) {
      if (this.addComments) {
        lines.push("# Add wires");
      }
      for (const wire of schematic.wires) {
        lines.push(this.generateWireCode(wire));
      }
      lines.push("");
    }

    if (schematic.labels.length > 0) {
      if (this.addComments) {
        lines.push("# Add labels");
      }
      for (const label of schematic.labels) {
        lines.push(this.generateLabelCode(label));
      }
      lines.push("");
    }

    if (schematic.globalLabels.length > 0) {
      if (this.addComments) {
        lines.push("# Add global labels");
      }
      for (const label of schematic.globalLabels) {
        lines.push(this.generateGlobalLabelCode(label));
      }
      lines.push("");
    }

    if (includeHierarchy && schematic.hierarchicalLabels.length > 0) {
      if (this.addComments) {
        lines.push("# Add hierarchical labels");
      }
      for (const label of schematic.hierarchicalLabels) {
        lines.push(this.generateHierarchicalLabelCode(label));
      }
      lines.push("");
    }

    if (schematic.junctions.length > 0) {
      if (this.addComments) {
        lines.push("# Add junctions");
      }
      for (const junction of schematic.junctions) {
        lines.push(
          `sch.junctions.add(position=(${junction.position.x}, ${junction.position.y}))`
        );
      }
      lines.push("");
    }

    if (schematic.noConnects.length > 0) {
      if (this.addComments) {
        lines.push("# Add no-connect markers");
      }
      for (const nc of schematic.noConnects) {
        lines.push(
          `sch.no_connects.add(position=(${nc.position.x}, ${nc.position.y}))`
        );
      }
      lines.push("");
    }

    if (outputPath) {
      if (this.addComments) {
        lines.push("# Save schematic");
      }
      lines.push(`sch.save("${this.escapeString(outputPath)}")`);
    }

    return lines.join("\n");
  }

  private generateComponentCode(component: Component): string {
    const pos = component.position;

    if (this.template === "minimal") {
      return `sch.components.add("${component.libId}", "${component.reference}", (${pos.x}, ${pos.y}))`;
    }

    let code = `sch.components.add(`;
    code += `lib_id="${component.libId}", `;
    code += `reference="${component.reference}", `;
    code += `value="${this.escapeString(component.value)}", `;
    code += `position=(${pos.x}, ${pos.y})`;

    if (component.rotation !== 0) {
      code += `, rotation=${component.rotation}`;
    }
    if (component.mirror) {
      code += `, mirror="${component.mirror}"`;
    }
    if (component.footprint) {
      code += `, footprint="${this.escapeString(component.footprint)}"`;
    }

    if (this.template === "verbose" || this.template === "documented") {
      if (component.unit !== 1) {
        code += `, unit=${component.unit}`;
      }
      if (!component.inBom) {
        code += `, in_bom=False`;
      }
    }

    code += ")";
    return code;
  }

  private generateWireCode(wire: Wire): string {
    if (wire.points.length === 2) {
      const start = wire.points[0];
      const end = wire.points[1];
      return `sch.wires.add(start=(${start.x}, ${start.y}), end=(${end.x}, ${end.y}))`;
    } else {
      const points = wire.points.map((p) => `(${p.x}, ${p.y})`).join(", ");
      return `sch.wires.add(points=[${points}])`;
    }
  }

  private generateLabelCode(label: Label): string {
    const pos = label.position;
    let code = `sch.labels.add(text="${this.escapeString(label.text)}", position=(${pos.x}, ${pos.y})`;
    if (label.rotation !== 0) {
      code += `, rotation=${label.rotation}`;
    }
    code += ")";
    return code;
  }

  private generateGlobalLabelCode(label: GlobalLabel): string {
    const pos = label.position;
    let code = `sch.global_labels.add(text="${this.escapeString(label.text)}", position=(${pos.x}, ${pos.y})`;
    if (label.rotation !== 0) {
      code += `, rotation=${label.rotation}`;
    }
    code += `, shape="${label.shape}"`;
    code += ")";
    return code;
  }

  private generateHierarchicalLabelCode(label: HierarchicalLabel): string {
    const pos = label.position;
    let code = `sch.hierarchical_labels.add(text="${this.escapeString(label.text)}", position=(${pos.x}, ${pos.y})`;
    if (label.rotation !== 0) {
      code += `, rotation=${label.rotation}`;
    }
    code += `, shape="${label.shape}"`;
    code += ")";
    return code;
  }

  private escapeString(s: string): string {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  /**
   * Write generated code to a file.
   */
  writeToFile(schematic: Schematic, outputPath: string): void {
    const code = this.generate(schematic, true, undefined);
    writeFileSync(outputPath, code);
  }
}
