import { describe, expect, it } from "vitest";
import { TBC, textCell } from "../cell";
import { fromBase, needsInput } from "./fields";
import { cellsOf, emptyCellsOf, fromCell, section, tab, table } from "./rows";

/** The shapes every tab is made of, and the one place a cell of the existing tech pack becomes a cell of this view. */

const view = () =>
  tab("overview", [
    section({ id: "a", title: "A", fields: [fromBase({ id: "f1", label: "One", text: "x" }), needsInput({ id: "f2", label: "Two" })] }),
    section({
      id: "b",
      title: "B",
      tables: [
        table({
          id: "t",
          title: "T",
          columns: ["C"],
          rows: [{ id: "r", label: "R", cells: [needsInput({ id: "c1", label: "Three" })] }],
        }),
      ],
    }),
  ]);

describe("a tab", () => {
  it("takes its label and its lead from the tab list, so one tab is named in one place", () => {
    expect(view().label).toBe("Overview");
    expect(view().lead.length).toBeGreaterThan(20);
  });

  it("reads its cells in reading order, fields first and then each table's rows", () => {
    expect(cellsOf(view()).map((entry) => entry.label)).toEqual(["One", "Two", "Three"]);
  });

  it("picks out just the cells that nothing fills yet", () => {
    expect(emptyCellsOf(view()).map((entry) => entry.label)).toEqual(["Two", "Three"]);
  });
});

describe("a section and a table", () => {
  it("start with no note, no addition and no row header unless one is given", () => {
    const part = section({ id: "a", title: "A" });
    expect(part).toEqual({ id: "a", title: "A", note: null, fields: [], tables: [] });
    const entry = table({ id: "t", title: "T", columns: [], rows: [] });
    expect(entry.addLabel).toBeNull();
    expect(entry.rowHeader).toBeNull();
    expect(entry.note).toBeNull();
  });
});

describe("a cell of the existing tech pack read as a cell of this view", () => {
  it("comes from the design when it holds a value", () => {
    const entry = fromCell({ id: "a", label: "Care instructions", ruleId: "R-LAB-002" }, textCell("Wash at 30", "user-edited"));
    expect(entry).toEqual({ id: "a", label: "Care instructions", text: "Wash at 30", provenance: "from_design", ruleId: "R-LAB-002", locked: false });
  });

  it("asks for a value nobody has filled in, and never carries the words that stand for one", () => {
    const entry = fromCell({ id: "a", label: "Care instructions" }, TBC);
    expect(entry.text).toBeNull();
    expect(entry.provenance).toBe("needs_input");
  });

  it("can be said to come from the base, for a row the base article fixes", () => {
    const entry = fromCell({ id: "a", label: "Seam", provenance: "from_base" }, textCell("Overlock", "derived"));
    expect(entry.provenance).toBe("from_base");
  });
});
