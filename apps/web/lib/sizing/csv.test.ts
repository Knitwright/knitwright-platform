import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

const records = (text: string): unknown => {
  const result = parseCsv(text);
  return result.ok ? result.records : result;
};

describe("parseCsv", () => {
  it("splits plain rows and numbers each by its line", () => {
    expect(records("a,b\n1,2\n")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["1", "2"] },
    ]);
  });

  it("reads Windows line endings and a final line without a line ending", () => {
    expect(records("a,b\r\n1,2")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["1", "2"] },
    ]);
  });

  it("drops a byte order mark at the start", () => {
    expect(records("﻿a,b\n")).toEqual([{ line: 1, cells: ["a", "b"] }]);
  });

  it("skips blank lines but keeps the real line numbers", () => {
    expect(records("a\n\n\nb\n\n\n")).toEqual([
      { line: 1, cells: ["a"] },
      { line: 4, cells: ["b"] },
    ]);
  });

  it("keeps commas, doubled quotes and line breaks inside quotes", () => {
    expect(records('a,b\n"x, y","say ""hi"""\n"two\nlines",z\nlast,row')).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["x, y", 'say "hi"'] },
      { line: 3, cells: ["two\nlines", "z"] },
      { line: 5, cells: ["last", "row"] },
    ]);
  });

  it("keeps empty cells", () => {
    expect(records("a,,c,\n")).toEqual([{ line: 1, cells: ["a", "", "c", ""] }]);
  });

  it("returns nothing for empty text", () => {
    expect(records("")).toEqual([]);
  });

  it("names the line where a quote is never closed", () => {
    const result = parseCsv('a,b\n1,"oops\n2,3');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBe(2);
      expect(result.message).toContain("Line 2");
      expect(result.message).toContain("quote");
    }
  });

  it("refuses a quote that opens in the middle of a cell", () => {
    const result = parseCsv('a,b"c"\n');
    expect(result.ok).toBe(false);
  });
});
