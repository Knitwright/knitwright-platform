import { describe, expect, it } from "vitest";
import { gridFromCsv, gridFromSheet } from "./grid";
import { CHART_IMPORT_LIMITS } from "./limits";

describe("gridFromCsv", () => {
  it("reads rows of text cells", () => {
    expect(gridFromCsv("Point,S,M\n\nChest width,50,52\n")).toEqual({
      ok: true,
      grid: [
        { line: 1, cells: ["Point", "S", "M"] },
        { line: 3, cells: ["Chest width", "50", "52"] },
      ],
    });
  });

  it("keeps a quoted comma, a doubled quote and a line break inside quotes as data", () => {
    const result = gridFromCsv('"Chest, flat","He said ""52""","a\nb"\n');
    expect(result).toEqual({ ok: true, grid: [{ line: 1, cells: ["Chest, flat", 'He said "52"', "a\nb"] }] });
  });

  it("keeps a cell that looks like a formula as plain text", () => {
    expect(gridFromCsv("=1+1,@SUM(A1)\n")).toEqual({ ok: true, grid: [{ line: 1, cells: ["=1+1", "@SUM(A1)"] }] });
  });

  it("pads short rows so every row has the same number of cells", () => {
    expect(gridFromCsv("a,b,c\nd\n")).toEqual({
      ok: true,
      grid: [
        { line: 1, cells: ["a", "b", "c"] },
        { line: 2, cells: ["d", "", ""] },
      ],
    });
  });

  it("refuses a quote that is never closed, naming the line", () => {
    const result = gridFromCsv('a,b\n"c,d\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Line 2/);
  });

  it("refuses an empty file", () => {
    expect(gridFromCsv("\n\n")).toEqual({ ok: false, message: expect.stringMatching(/empty/) });
  });

  it("refuses more rows than allowed", () => {
    const text = Array.from({ length: CHART_IMPORT_LIMITS.maxRows + 1 }, () => "a,b").join("\n");
    const result = gridFromCsv(text);
    expect(result).toEqual({ ok: false, message: expect.stringContaining(String(CHART_IMPORT_LIMITS.maxRows)) });
  });

  it("refuses more columns than allowed", () => {
    const text = Array.from({ length: CHART_IMPORT_LIMITS.maxColumns + 1 }, () => "a").join(",");
    const result = gridFromCsv(text);
    expect(result).toEqual({ ok: false, message: expect.stringContaining(String(CHART_IMPORT_LIMITS.maxColumns)) });
  });

  it("refuses a cell longer than allowed", () => {
    const result = gridFromCsv("x".repeat(CHART_IMPORT_LIMITS.maxCellLength + 1));
    expect(result).toEqual({ ok: false, message: expect.stringContaining("too long") });
  });

  it("drops empty columns at the right edge", () => {
    expect(gridFromCsv("a,b,,\nc,d,,\n")).toEqual({
      ok: true,
      grid: [
        { line: 1, cells: ["a", "b"] },
        { line: 2, cells: ["c", "d"] },
      ],
    });
  });
});

describe("gridFromSheet", () => {
  it("turns every kind of cell into text", () => {
    const result = gridFromSheet([
      ["Point", "S", null],
      ["Chest width", "52.5", true],
      [new Date("2026-10-02T00:00:00Z"), 7, false],
    ]);
    expect(result).toEqual({
      ok: true,
      grid: [
        { line: 1, cells: ["Point", "S", ""] },
        { line: 2, cells: ["Chest width", "52.5", "TRUE"] },
        { line: 3, cells: ["2026-10-02", "7", "FALSE"] },
      ],
    });
  });

  it("reads a date that is not a real date as empty", () => {
    expect(gridFromSheet([[new Date(Number.NaN), "a"]])).toEqual({ ok: true, grid: [{ line: 1, cells: ["", "a"] }] });
  });

  it("treats an unexpected kind of cell as empty", () => {
    expect(gridFromSheet([[{ weird: true }, "a"]])).toEqual({ ok: true, grid: [{ line: 1, cells: ["", "a"] }] });
  });

  it("applies the same limits as a CSV file", () => {
    const rows = Array.from({ length: CHART_IMPORT_LIMITS.maxRows + 1 }, () => ["a"]);
    expect(gridFromSheet(rows).ok).toBe(false);
  });

  it("drops rows with nothing in them and keeps each row's line in the sheet", () => {
    expect(gridFromSheet([["a"], [null, ""], ["b"]])).toEqual({
      ok: true,
      grid: [
        { line: 1, cells: ["a"] },
        { line: 3, cells: ["b"] },
      ],
    });
  });
});
