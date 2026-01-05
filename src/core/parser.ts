// src/core/parser.ts

import { ParseError } from "./exceptions";

/**
 * Represents a symbol (atom) in an S-expression.
 * Symbols are unquoted identifiers like `kicad_sch`, `wire`, `at`, etc.
 */
export class Symbol {
  constructor(public readonly name: string) {}

  toString(): string {
    return this.name;
  }

  equals(other: unknown): boolean {
    return other instanceof Symbol && other.name === this.name;
  }
}

export type SExp = Symbol | string | number | boolean | SExp[];

// Token types
type Token =
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "string"; value: string }
  | { type: "atom"; value: string }
  | { type: "eof" };

/**
 * Tokenizer for S-expressions.
 */
class Tokenizer {
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(private input: string) {}

  peek(): Token {
    const savedPos = this.pos;
    const savedLine = this.line;
    const savedColumn = this.column;
    const token = this.next();
    this.pos = savedPos;
    this.line = savedLine;
    this.column = savedColumn;
    return token;
  }

  next(): Token {
    this.skipWhitespace();
    if (this.pos >= this.input.length) return { type: "eof" };

    const char = this.input[this.pos];

    if (char === "(") {
      this.advance();
      return { type: "lparen" };
    }

    if (char === ")") {
      this.advance();
      return { type: "rparen" };
    }

    if (char === '"') {
      return { type: "string", value: this.readString() };
    }

    return { type: "atom", value: this.readAtom() };
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
      } else if (char === "\n") {
        this.advance();
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private readString(): string {
    let result = "";
    this.advance(); // Skip opening quote

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (char === '"') {
        this.advance(); // Skip closing quote
        return result;
      }

      if (char === "\\") {
        this.advance();
        if (this.pos >= this.input.length) {
          throw new ParseError(
            "Unexpected end of input in string escape",
            this.line,
            this.column
          );
        }
        const escaped = this.input[this.pos];
        switch (escaped) {
          case "n":
            result += "\n";
            break;
          case "t":
            result += "\t";
            break;
          case "r":
            result += "\r";
            break;
          case "\\":
            result += "\\";
            break;
          case '"':
            result += '"';
            break;
          default:
            result += escaped;
        }
        this.advance();
      } else {
        result += char;
        this.advance();
      }
    }

    throw new ParseError("Unterminated string", this.line, this.column);
  }

  private readAtom(): string {
    let result = "";

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (
        char === "(" ||
        char === ")" ||
        char === '"' ||
        char === " " ||
        char === "\t" ||
        char === "\n" ||
        char === "\r"
      ) {
        break;
      }
      result += char;
      this.advance();
    }

    return result;
  }

  getPosition(): { line: number; column: number } {
    return { line: this.line, column: this.column };
  }
}

/**
 * S-expression parser.
 */
export class SExpressionParser {
  parse(input: string): SExp {
    const tokenizer = new Tokenizer(input);
    const result = this.parseExpression(tokenizer);

    // Ensure we've consumed all input
    const next = tokenizer.peek();
    if (next.type !== "eof") {
      const pos = tokenizer.getPosition();
      throw new ParseError(
        "Unexpected content after expression",
        pos.line,
        pos.column
      );
    }

    return result;
  }

  private parseExpression(tokenizer: Tokenizer): SExp {
    const token = tokenizer.next();

    if (token.type === "eof") {
      throw new ParseError("Unexpected end of input");
    }

    if (token.type === "lparen") {
      return this.parseList(tokenizer);
    }

    if (token.type === "rparen") {
      throw new ParseError("Unexpected closing parenthesis");
    }

    if (token.type === "string") {
      // Quoted strings are returned as-is (string type)
      return token.value;
    }

    if (token.type === "atom") {
      return this.parseAtom(token.value);
    }

    throw new ParseError("Unexpected token");
  }

  private parseList(tokenizer: Tokenizer): SExp[] {
    const list: SExp[] = [];

    while (true) {
      const peek = tokenizer.peek();

      if (peek.type === "eof") {
        throw new ParseError("Unexpected end of input in list");
      }

      if (peek.type === "rparen") {
        tokenizer.next(); // Consume the ')'
        return list;
      }

      list.push(this.parseExpression(tokenizer));
    }
  }

  private parseAtom(token: string): SExp {
    // Check for boolean
    if (token === "yes" || token === "true") return true;
    if (token === "no" || token === "false") return false;

    // Check for number
    const num = this.tryParseNumber(token);
    if (num !== null) return num;

    // It's a symbol (unquoted identifier)
    return new Symbol(token);
  }

  private tryParseNumber(token: string): number | null {
    // Handle integers
    if (/^-?\d+$/.test(token)) {
      return parseInt(token, 10);
    }

    // Handle floats (including scientific notation)
    if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(token)) {
      return parseFloat(token);
    }

    return null;
  }
}

// Utility functions for working with S-expressions

export function isSymbol(sexp: SExp): sexp is Symbol {
  return sexp instanceof Symbol;
}

export function isList(sexp: SExp): sexp is SExp[] {
  return Array.isArray(sexp);
}

export function getTag(sexp: SExp[]): string | null {
  if (sexp.length > 0 && isSymbol(sexp[0])) {
    return sexp[0].name;
  }
  return null;
}

export function findElement(list: SExp[], tag: string): SExp[] | null {
  for (const item of list) {
    if (isList(item) && getTag(item) === tag) {
      return item;
    }
  }
  return null;
}

export function findElements(list: SExp[], tag: string): SExp[][] {
  const result: SExp[][] = [];
  for (const item of list) {
    if (isList(item) && getTag(item) === tag) {
      result.push(item);
    }
  }
  return result;
}

export function getAtomValue(list: SExp[], index: number): SExp | null {
  if (index < list.length) {
    return list[index];
  }
  return null;
}

export function getStringValue(list: SExp[], index: number): string | null {
  const value = getAtomValue(list, index);
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (isSymbol(value)) {
    return value.name;
  }
  return null;
}

export function getNumberValue(list: SExp[], index: number): number | null {
  const value = getAtomValue(list, index);
  if (typeof value === "number") {
    return value;
  }
  return null;
}

export function getBoolValue(list: SExp[], index: number): boolean | null {
  const value = getAtomValue(list, index);
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}
