// src/core/formatter.ts

import { Symbol, SExp, isSymbol, isList, getTag } from "./parser";
import { FormatError } from "./exceptions";

/**
 * Block elements that have their children on separate lines.
 */
const BLOCK_ELEMENTS = new Set([
  "kicad_sch",
  "lib_symbols",
  "symbol",
  "wire",
  "bus",
  "bus_entry",
  "junction",
  "no_connect",
  "label",
  "global_label",
  "hierarchical_label",
  "netclass_flag",
  "text",
  "text_box",
  "rectangle",
  "polyline",
  "circle",
  "arc",
  "sheet",
  "sheet_instances",
  "symbol_instances",
  "image",
  "property",
  "title_block",
  "instances",
  "project",
  "path",
  "stroke",
  "fill",
  "font",
  "effects",
  "pts",
  "pin_numbers",
  "pin_names",
  "pin",
  "name",
  "number",
]);

/**
 * Formatter that produces output identical to KiCAD's native format.
 */
export class ExactFormatter {
  private indentChar: string = "\t";

  format(sexp: SExp): string {
    if (!isList(sexp)) {
      return this.formatAtom(sexp);
    }
    return this.formatElement(sexp, 0, true);
  }

  private formatElement(sexp: SExp[], depth: number, isTopLevel: boolean = false): string {
    if (sexp.length === 0) {
      return "()";
    }

    const tag = getTag(sexp);

    // Block elements use multi-line format
    if (tag && BLOCK_ELEMENTS.has(tag)) {
      return this.formatBlock(sexp, depth, isTopLevel);
    }

    // Everything else is inline
    return this.formatInline(sexp);
  }

  private formatInline(sexp: SExp[]): string {
    const parts = sexp.map((item) => {
      if (isList(item)) {
        return this.formatInline(item);
      }
      return this.formatAtom(item);
    });
    return `(${parts.join(" ")})`;
  }

  private formatBlock(sexp: SExp[], depth: number, isTopLevel: boolean): string {
    const indent = isTopLevel ? "" : this.indentChar.repeat(depth);
    const childIndent = this.indentChar.repeat(depth + 1);
    const lines: string[] = [];

    const tag = getTag(sexp);
    const tagStr = this.formatAtom(sexp[0]);

    // Collect inline elements for the opening line
    const inlineParts: string[] = [tagStr];
    let i = 1;

    // For most block elements, non-list values stay on the opening line
    while (i < sexp.length) {
      const item = sexp[i];
      
      if (!isList(item)) {
        // Simple atom - stays on tag line
        inlineParts.push(this.formatAtom(item));
        i++;
      } else {
        // List element - stop collecting inline parts
        break;
      }
    }

    // If no more children, format as single line
    if (i >= sexp.length) {
      return `${indent}(${inlineParts.join(" ")})`;
    }

    // Build opening line
    lines.push(`${indent}(${inlineParts.join(" ")}`);

    // Process remaining children based on element type
    if (tag === "pts") {
      // Special handling for pts: all xy elements on one line
      const xyParts: string[] = [];
      for (; i < sexp.length; i++) {
        const item = sexp[i];
        if (isList(item)) {
          xyParts.push(this.formatInline(item));
        }
      }
      if (xyParts.length > 0) {
        lines.push(`${childIndent}${xyParts.join(" ")}`);
      }
    } else {
      // Regular block formatting
      for (; i < sexp.length; i++) {
        const item = sexp[i];

        if (isList(item)) {
          const itemTag = getTag(item);
          
          if (itemTag && BLOCK_ELEMENTS.has(itemTag)) {
            // Recursive block formatting
            lines.push(this.formatElement(item, depth + 1));
          } else {
            // Inline element on its own line
            lines.push(`${childIndent}${this.formatInline(item)}`);
          }
        } else {
          // Simple value on its own line
          lines.push(`${childIndent}${this.formatAtom(item)}`);
        }
      }
    }

    // Closing paren
    lines.push(`${indent})`);

    return lines.join("\n");
  }

  private formatAtom(atom: SExp): string {
    if (isSymbol(atom)) {
      return atom.name;
    }

    if (typeof atom === "string") {
      return this.formatString(atom);
    }

    if (typeof atom === "number") {
      return this.formatNumber(atom);
    }

    if (typeof atom === "boolean") {
      return atom ? "yes" : "no";
    }

    throw new FormatError(`Unknown atom type: ${typeof atom}`);
  }

  private formatString(str: string): string {
    // Always quote strings (they were originally quoted in the input)
    const escaped = str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");

    return `"${escaped}"`;
  }

  private formatNumber(num: number): string {
    if (Number.isInteger(num)) {
      return num.toString();
    }

    // For floats, match KiCAD's formatting
    let str = num.toFixed(6);

    // Remove trailing zeros, but preserve meaningful precision
    str = str.replace(/(\.\d*?)0+$/, "$1");
    str = str.replace(/\.$/, "");

    return str;
  }
}
