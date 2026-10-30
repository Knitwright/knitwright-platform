import { describe, expect, it } from "vitest";
import { TECHPACK_TABS } from "./tabs";
import { ALL_TABS, buildTechPackView, liveLength, tabIdsOf } from "./model";
import { article, bareArticle, emptyDesign, emptyHeader, input, mark } from "./fixtures/views";
import { cellsOf } from "./rows";

/**
 * The whole tech pack view, assembled from what the editor's slot contract hands a panel. It is a
 * pure function of that input: the same design gives the same view, which is what lets the panel,
 * the Excel and the PDF read one set of numbers.
 */

describe("the assembled view", () => {
  it("has every one of the spec's eleven tabs, in the spec's order", () => {
    expect(tabIdsOf(buildTechPackView(input()))).toEqual([...TECHPACK_TABS]);
    expect(ALL_TABS).toEqual([...TECHPACK_TABS]);
  });

  it("is the same view twice for the same design, so nothing in it is worked out from the clock", () => {
    expect(buildTechPackView(input())).toEqual(buildTechPackView(input()));
  });

  it("carries the unit, the mode and the shown size the editor is on", () => {
    const view = buildTechPackView(input({ unit: "in", mode: "grading", size: "XL" }));
    expect(view.unit).toBe("in");
    expect(view.mode).toBe("grading");
    expect(view.size).toBe("XL");
    expect(view.measurements.unit).toBe("in");
  });

  it("counts the provenance chips of every field, so the legend can show them", () => {
    const counts = buildTechPackView(input()).counts;
    expect(counts.from_base).toBeGreaterThan(0);
    expect(counts.from_design).toBeGreaterThan(0);
    expect(counts.needs_input).toBeGreaterThan(0);
    expect(counts.from_base + counts.from_design + counts.needs_input + counts.confirmed).toBeGreaterThan(50);
  });

  it("gives the Measurements tab a cell for every column of every row of the table", () => {
    const view = buildTechPackView(input());
    const poms = view.tabs.find((entry) => entry.id === "measurements")?.sections[0]?.tables[0];
    expect(poms?.columns).toEqual(["Letter", "Measurement", "Grade type", "Grade", "Tol −", "Tol +", "XS", "S", "M", "L", "XL", "2XL", "3XL", "Rule"]);
    for (const row of poms?.rows ?? []) expect(row.cells, row.label).toHaveLength(14);
    expect(poms?.addLabel).toBe("Add measurement");
  });

  it("locks every cell of a point of measure the base grades, and unlocks an extra one", () => {
    const view = buildTechPackView(input({ extras: [{ letter: "", description: "Pocket opening", sampleMm: 140, ruleId: null }] }));
    const rows = view.tabs.find((entry) => entry.id === "measurements")?.sections[0]?.tables[0]?.rows ?? [];
    expect(rows[0]?.cells.filter((entry) => entry.text !== null).every((entry) => entry.locked)).toBe(true);
    expect(rows.at(-1)?.cells.every((entry) => !entry.locked)).toBe(true);
  });

  it("letters an extra point after the base's own, so no two rows share a letter", () => {
    const view = buildTechPackView(input({ extras: [{ letter: "", description: "Pocket opening", sampleMm: 140, ruleId: null }], marks: [mark()] }));
    const letters = view.measurements.rows.map((row) => row.letter);
    expect(letters.slice(-2)).toEqual(["M", "N"]);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("keeps a letter the founder chose for their own point", () => {
    const view = buildTechPackView(input({ extras: [{ letter: "Z", description: "Pocket opening", sampleMm: 140, ruleId: null }], marks: [mark()] }));
    expect(view.measurements.rows.map((row) => row.letter).slice(-2)).toEqual(["Z", "M"]);
  });

  it("letters from A when the base article has no point of measure at all", () => {
    const view = buildTechPackView(input({ article: bareArticle(), sizes: bareArticle().sizeRange, marks: [mark()] }));
    expect(view.measurements.rows.map((row) => row.letter)).toEqual(["A"]);
  });

  it("gives the Review tab no field of its own, so no empty field is counted twice", () => {
    const view = buildTechPackView(input());
    const review = view.tabs.find((entry) => entry.id === "review");
    expect(cellsOf(review!)).toEqual([]);
    expect(review?.sections[0]?.note).toBe(view.review.summary);
  });

  it("reports what Auto-map would place", () => {
    expect(buildTechPackView(input()).autoMap.missing).toEqual([]);
    expect(buildTechPackView(input({ article: null })).autoMap.letters).toEqual([]);
  });

  it("builds a view for a design off the catalogue without inventing anything for it", () => {
    const view = buildTechPackView(input({ article: null, spec: emptyDesign(), header: emptyHeader(), sizes: [] }));
    expect(tabIdsOf(view)).toEqual([...TECHPACK_TABS]);
    expect(view.measurements.rows).toEqual([]);
    expect(view.counts.from_base).toBe(0);
    expect(view.review.exportBlocked).toBe(true);
  });

  it("shows the Specs toolbar's live length in the view's own unit", () => {
    expect(liveLength(437, "mm")).toBe("437");
    expect(liveLength(437, "cm")).toBe("43.7");
    expect(liveLength(null, "mm")).toBeNull();
  });

  it("reads the chest width of the sample size as the catalogue has it", () => {
    const view = buildTechPackView(input());
    const chest = view.measurements.rows[0];
    expect(chest?.letter).toBe("A");
    expect(chest?.values.find((value) => value.isSample)?.text).toBe(String(article().poms[0]?.valuesMm.M));
  });
});
