import { describe, expect, it } from "vitest";
import { gridFromCsv, type Grid } from "./grid";
import { suggestMapping } from "./mapping";
import {
  columnChoices,
  initialScreen,
  pointChoices,
  rowPreview,
  setRowPoint,
  sizeLabels,
  toMapping,
  toggleSizeColumn,
  type ChartScreen,
} from "./screen";

const grid = ((): Grid => {
  const read = gridFromCsv("Point of measure,S,M,L,Tol\nChest width,1,2,3,1\nWaist,1,2,3,1\n");
  if (!read.ok) throw new Error(read.message);
  return read.grid;
})();

const start = (): ChartScreen => initialScreen(suggestMapping(grid));

describe("the chart mapping screen", () => {
  it("starts from the suggestion, with a crew tee for men and no person named", () => {
    expect(start()).toMatchObject({
      wearer: "men",
      garmentType: "crew-tee",
      fit: null,
      headerLine: 1,
      pointColumn: 0,
      sizeColumns: [1, 2, 3],
      toleranceColumn: 4,
      baseSize: "M",
      person: "",
      rowPoints: [],
    });
  });

  it("lists each column of the heading row by number and name", () => {
    expect(columnChoices(grid, 1)).toEqual([
      { index: 0, label: "Column 1: Point of measure" },
      { index: 1, label: "Column 2: S" },
      { index: 2, label: "Column 3: M" },
      { index: 3, label: "Column 4: L" },
      { index: 4, label: "Column 5: Tol" },
    ]);
    expect(columnChoices(grid, 42)).toEqual([]);
  });

  it("gives the size names in column order", () => {
    expect(sizeLabels(grid, start())).toEqual(["S", "M", "L"]);
  });

  it("adds and removes a size column, keeping column order, and clears a base size that went away", () => {
    const without = toggleSizeColumn(grid, start(), 2);
    expect(without.sizeColumns).toEqual([1, 3]);
    expect(without.baseSize).toBe("");
    expect(toggleSizeColumn(grid, without, 2).sizeColumns).toEqual([1, 2, 3]);
    expect(toggleSizeColumn(grid, start(), 1).baseSize).toBe("M");
  });

  it("changes a row's point without touching the old state, and can go back to matching by name", () => {
    const before = start();
    const chosen = setRowPoint(before, 3, "hem-width");
    expect(before.rowPoints).toEqual([]);
    expect(chosen.rowPoints).toEqual([{ line: 3, pointId: "hem-width" }]);
    expect(setRowPoint(chosen, 3, null).rowPoints).toEqual([{ line: 3, pointId: null }]);
    expect(setRowPoint(chosen, 3, "auto").rowPoints).toEqual([]);
  });

  it("shows which point each row gives", () => {
    expect(rowPreview(grid, start())).toEqual([
      { line: 2, label: "Chest width", pointId: "chest-width", chosen: false },
      { line: 3, label: "Waist", pointId: null, chosen: false },
    ]);
  });

  it("offers only the points the garment can have", () => {
    const ids = pointChoices("crew-tee").map((choice) => choice.id);
    expect(ids).toContain("chest-width");
    expect(ids).not.toContain("collar-height");
    expect(pointChoices("cape")).toEqual([]);
  });

  it("asks for a tolerance column before sending", () => {
    const result = toMapping({ ...start(), toleranceColumn: null, person: "Test Person" });
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/tolerance/) });
  });

  it("asks for the person's name before sending", () => {
    expect(toMapping(start())).toEqual({ ok: false, message: expect.stringMatching(/person/) });
  });

  it("gives a mapping the server accepts", () => {
    const result = toMapping({ ...start(), person: "Test Person" });
    expect(result).toMatchObject({ ok: true, mapping: { toleranceColumn: 4, person: "Test Person" } });
  });
});
