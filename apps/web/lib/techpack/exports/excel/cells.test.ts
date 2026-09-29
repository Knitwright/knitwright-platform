import { describe, expect, it } from "vitest";
import { ExportRefused } from "../errors";
import { LENGTH_FORMAT, headerCell, numberCell, sheetNameProblem, textCell, titleCell } from "./cells";

describe("the cells of an Excel file", () => {
  it("makes text as a text cell in the text format, whatever it says", () => {
    for (const text of ["=1+1", "+1", "-2", "@SUM(A1)", "\t=x", "\r=x", "=cmd|' /C calc'!A0", "plain"]) {
      expect(textCell(text)).toEqual({ value: text, type: String, format: "@", wrap: true });
    }
  });

  it("makes no cell for text that is empty, because the writer would write no cell either", () => {
    expect(textCell("")).toBeNull();
  });

  it("makes a number as a number cell with its format, and refuses one that is not a finite number", () => {
    expect(numberCell(5.23, LENGTH_FORMAT)).toEqual({ value: 5.23, type: Number, format: LENGTH_FORMAT });
    expect(numberCell(180)).toEqual({ value: 180, type: Number });
    for (const bad of [Number.NaN, Infinity, -Infinity]) expect(() => numberCell(bad)).toThrow(ExportRefused);
  });

  it("makes headers and titles as bold text cells that do not wrap", () => {
    expect(headerCell("Value")).toEqual({ value: "Value", type: String, format: "@", fontWeight: "bold", wrap: true });
    expect(titleCell("=Title")).toEqual({ value: "=Title", type: String, format: "@", fontWeight: "bold" });
  });

  it("never makes a formula: no cell it makes has that type", () => {
    const made = [textCell("=1"), numberCell(1), headerCell("=x"), titleCell("=x")];
    for (const cell of made) expect((cell as { type?: unknown } | null)?.type === "Formula").toBe(false);
  });
});

describe("sheet names", () => {
  it("accepts the names Excel accepts", () => {
    for (const name of ["Cover", "Labels and packing", "a".repeat(31), "Sign-off"]) expect(sheetNameProblem(name), name).toBeNull();
  });

  it("refuses an empty name, one over 31 characters, and each character Excel forbids", () => {
    expect(sheetNameProblem("")).not.toBeNull();
    expect(sheetNameProblem("a".repeat(32))).not.toBeNull();
    for (const bad of ["\\", "/", "?", "*", "[", "]", ":"]) expect(sheetNameProblem(`a${bad}b`), bad).not.toBeNull();
    expect(sheetNameProblem("'quoted")).not.toBeNull();
    expect(sheetNameProblem("quoted'")).not.toBeNull();
  });
});
