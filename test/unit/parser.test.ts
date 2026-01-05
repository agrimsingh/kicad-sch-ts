// test/unit/parser.test.ts

import { SExpressionParser, Symbol, Float, SExp } from "../../src/core/parser";

describe("SExpressionParser", () => {
  const parser = new SExpressionParser();

  it("should parse a simple list", () => {
    const result = parser.parse("(hello world)") as SExp[];
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Symbol);
    expect((result[0] as Symbol).name).toBe("hello");
    expect(result[1]).toBeInstanceOf(Symbol);
    expect((result[1] as Symbol).name).toBe("world");
  });

  it("should parse nested lists", () => {
    const result = parser.parse("(a (b c) d)") as SExp[];
    expect(result).toHaveLength(3);
    expect((result[0] as Symbol).name).toBe("a");
    expect(Array.isArray(result[1])).toBe(true);
    expect((result[1] as SExp[]).length).toBe(2);
    expect((result[2] as Symbol).name).toBe("d");
  });

  it("should parse numbers", () => {
    const result = parser.parse("(num 42 3.14 -5)") as SExp[];
    expect(result).toHaveLength(4);
    expect((result[0] as Symbol).name).toBe("num");
    expect(result[1]).toBe(42);
    // Floats are wrapped in Float class to preserve original format
    expect((result[2] as Float).value).toBeCloseTo(3.14);
    expect(result[3]).toBe(-5);
  });

  it("should parse strings with escapes", () => {
    const result = parser.parse('(text "hello\\"world")') as SExp[];
    expect(result).toHaveLength(2);
    expect((result[0] as Symbol).name).toBe("text");
    expect(result[1]).toBe('hello"world');
  });

  it("should parse strings with newlines", () => {
    const result = parser.parse('(text "line1\\nline2")') as SExp[];
    expect(result).toHaveLength(2);
    expect(result[1]).toBe("line1\nline2");
  });

  it("should parse booleans", () => {
    const result = parser.parse("(flags yes no)") as SExp[];
    expect(result).toHaveLength(3);
    expect((result[0] as Symbol).name).toBe("flags");
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
  });

  it("should parse empty list", () => {
    const result = parser.parse("()") as SExp[];
    expect(result).toHaveLength(0);
  });

  it("should parse deeply nested lists", () => {
    const result = parser.parse("(a (b (c (d e))))") as SExp[];
    expect(result).toHaveLength(2);
    const level1 = result[1] as SExp[];
    expect(level1.length).toBe(2);
    const level2 = level1[1] as SExp[];
    expect(level2.length).toBe(2);
    const level3 = level2[1] as SExp[];
    expect(level3.length).toBe(2);
  });

  it("should parse float with many decimals", () => {
    const result = parser.parse("(at 96.52 100.33 0)") as SExp[];
    expect(result).toHaveLength(4);
    expect((result[1] as Float).value).toBeCloseTo(96.52);
    expect((result[2] as Float).value).toBeCloseTo(100.33);
    expect(result[3]).toBe(0);
  });

  it("should parse KiCAD-style uuid", () => {
    const result = parser.parse('(uuid "a5ebdc97-f1ba-4650-8f00-5e19694cb317")') as SExp[];
    expect(result).toHaveLength(2);
    expect(result[1]).toBe("a5ebdc97-f1ba-4650-8f00-5e19694cb317");
  });
});
