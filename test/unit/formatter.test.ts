// test/unit/formatter.test.ts

import { SExpressionParser, Symbol } from "../../src/core/parser";
import { ExactFormatter } from "../../src/core/formatter";

describe("ExactFormatter", () => {
  const parser = new SExpressionParser();
  const formatter = new ExactFormatter();

  it("should format a simple list", () => {
    const sexp = [new Symbol("hello"), new Symbol("world")];
    const result = formatter.format(sexp);
    expect(result).toBe("(hello world)");
  });

  it("should format numbers correctly", () => {
    const sexp = [new Symbol("num"), 42, 3.14, -5];
    const result = formatter.format(sexp);
    expect(result).toBe("(num 42 3.14 -5)");
  });

  it("should format booleans as yes/no", () => {
    const sexp = [new Symbol("flags"), true, false];
    const result = formatter.format(sexp);
    expect(result).toBe("(flags yes no)");
  });

  it("should format strings with spaces", () => {
    const sexp = [new Symbol("title"), "hello world"];
    const result = formatter.format(sexp);
    expect(result).toBe('(title "hello world")');
  });

  it("should escape special characters in strings", () => {
    const sexp = [new Symbol("value"), 'hello"world'];
    const result = formatter.format(sexp);
    expect(result).toBe('(value "hello\\"world")');
  });

  it("should format inline elements correctly", () => {
    const sexp = [new Symbol("at"), 96.52, 100.33, 0];
    const result = formatter.format(sexp);
    expect(result).toBe("(at 96.52 100.33 0)");
  });

  it("should format xy points correctly", () => {
    const sexp = [new Symbol("xy"), 100, 80];
    const result = formatter.format(sexp);
    expect(result).toBe("(xy 100 80)");
  });

  it("should format version correctly", () => {
    const sexp = [new Symbol("version"), 20250114];
    const result = formatter.format(sexp);
    expect(result).toBe("(version 20250114)");
  });

  it("should format integers without decimal point", () => {
    const sexp = [new Symbol("unit"), 1];
    const result = formatter.format(sexp);
    expect(result).toBe("(unit 1)");
  });

  it("should format floats with minimal decimals", () => {
    const sexp = [new Symbol("width"), 0.254];
    const result = formatter.format(sexp);
    expect(result).toBe("(width 0.254)");
  });
});
