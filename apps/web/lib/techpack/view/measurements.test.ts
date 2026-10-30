import { describe, expect, it } from "vitest";
import { GAP_RULE } from "@/lib/kpp/model";
import { article, bareArticle } from "./fixtures/views";
import { GRADE_TYPE_LABELS, MEASUREMENT_MODES, MODE_LABELS, autoMapPlan, buildMeasurements, nextExtraLetter } from "./measurements";

/**
 * Spec F-S6's Measurements tab: the letter, the measurement, the grade type, the grade, both
 * tolerances, one column per size with the sample size highlighted, and the rule. The grades come
 * from the base article and are locked. The table is read against the seeded `JSY-SS-01`, so a
 * change to X1's rows shows up here.
 */
const table = (patch: Partial<Parameters<typeof buildMeasurements>[0]> = {}) =>
  buildMeasurements({ article: article(), sizes: article().sizeRange, extras: [], mode: "measurement", unit: "mm", ...patch });

describe("the point-of-measure table", () => {
  it("has a column for every size of the article, with the sample size highlighted and no other", () => {
    const view = table();
    expect(view.columns.map((column) => column.size)).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(view.columns.filter((column) => column.isSample).map((column) => column.size)).toEqual(["M"]);
  });

  it("has a row for every point of measure the base article carries, in the catalogue's order", () => {
    const view = table();
    expect(view.rows.map((row) => row.letter)).toEqual(article().poms.map((pom) => pom.letter));
    expect(view.rows).toHaveLength(12);
  });

  it("locks every row the base article grades, and carries the base's own rule on it", () => {
    for (const row of table().rows) {
      expect(row.locked, row.letter).toBe(true);
      expect(row.provenance, row.letter).toBe("from_base");
      expect(row.ruleId, row.letter).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
    }
  });

  it("reads the chest width of size M as the article has it, in whichever unit is chosen", () => {
    const chest = (unit: "mm" | "cm" | "in") => table({ unit }).rows[0]?.values.find((value) => value.size === "M")?.text;
    expect(chest("mm")).toBe("520");
    expect(chest("cm")).toBe("52.0");
    expect(chest("in")).toBe("20.47");
  });

  it("shows a grade for a point that grades and none at all for one that does not", () => {
    const rows = table().rows;
    const linear = rows.find((row) => row.gradeType === "linear");
    const fixed = rows.find((row) => row.gradeType === "fixed");
    expect(linear?.grade).toBe("30");
    expect(linear?.gradeTypeLabel).toBe("Linear");
    expect(fixed?.grade).toBeNull();
    expect(fixed?.gradeTypeLabel).toBe("Fixed");
  });

  it("names every grade type the catalogue can hold", () => {
    expect(Object.values(GRADE_TYPE_LABELS)).toEqual(["Linear", "Non-linear", "Ungraded", "Fixed"]);
  });

  it("reads both tolerances with their signs", () => {
    const chest = table().rows[0];
    expect(chest?.tolMinus).toBe("-10");
    expect(chest?.tolPlus).toBe("+10");
  });

  it("works the step between sizes out from the article's own values, not from the nominal grade", () => {
    const chest = table().rows[0];
    expect(chest?.steps.map((step) => step.text)).toEqual([null, "30", "30", "30", "30", "30", "30"]);
    expect(chest?.steps[0]?.text).toBeNull();
  });

  it("gives a point that does not change across the size run a step of nothing but zero", () => {
    const fixed = table().rows.find((row) => row.gradeType === "fixed");
    expect(fixed?.steps.slice(1).every((step) => step.text === "0")).toBe(true);
  });

  it("has no step at all where a size has no value", () => {
    const sparse = table({ sizes: ["XS", "NOT-A-SIZE", "M"] }).rows[0];
    expect(sparse?.steps.map((step) => step.text)).toEqual([null, null, null]);
  });

  it("offers the Measurement and Grading toggle the spec names", () => {
    expect(MEASUREMENT_MODES).toEqual(["measurement", "grading"]);
    expect(Object.values(MODE_LABELS)).toEqual(["Measurement", "Grading"]);
    expect(table({ mode: "grading" }).mode).toBe("grading");
  });

  it("falls back to the article's own size range when the editor is showing none", () => {
    expect(table({ sizes: [] }).columns).toHaveLength(7);
  });
});

describe("an extra point of measure a founder added", () => {
  const extra = { letter: "Q", description: "Pocket opening", sampleMm: 140, ruleId: null };

  it("is ungraded, has no grade and has no tolerance invented for it", () => {
    const row = table({ extras: [extra] }).rows.at(-1);
    expect(row?.isExtra).toBe(true);
    expect(row?.gradeType).toBe("ungraded");
    expect(row?.grade).toBeNull();
    expect(row?.tolMinus).toBeNull();
    expect(row?.tolPlus).toBeNull();
    expect(row?.steps.every((step) => step.text === null)).toBe(true);
    expect(row?.ruleId).toBe(GAP_RULE);
  });

  it("carries its value in the sample size's column only, because nothing grades it", () => {
    const row = table({ extras: [extra] }).rows.at(-1);
    expect(row?.values.filter((value) => value.text !== null).map((value) => value.size)).toEqual(["M"]);
    expect(row?.values.find((value) => value.size === "M")?.text).toBe("140");
  });

  it("is unlocked, because it is the founder's own, and asks for a measurement until one is taken", () => {
    const measured = table({ extras: [extra] }).rows.at(-1);
    const unmeasured = table({ extras: [{ ...extra, sampleMm: null }] }).rows.at(-1);
    expect(measured?.locked).toBe(false);
    expect(measured?.provenance).toBe("from_design");
    expect(unmeasured?.provenance).toBe("needs_input");
    expect(unmeasured?.values.every((value) => value.text === null)).toBe(true);
  });

  it("keeps a rule the founder's own tool gave it", () => {
    expect(table({ extras: [{ ...extra, ruleId: "R-QC-002" }] }).rows.at(-1)?.ruleId).toBe("R-QC-002");
  });
});

describe("a design the catalogue does not cover", () => {
  it("says so, and shows no point of measure at all", () => {
    const view = buildMeasurements({ article: null, sizes: ["S", "M"], extras: [], mode: "measurement", unit: "mm" });
    expect(view.rows).toEqual([]);
    expect(view.note).toContain("not on a base article");
    expect(view.columns.map((column) => column.size)).toEqual(["S", "M"]);
    expect(view.columns.some((column) => column.isSample)).toBe(false);
  });

  it("says plainly that a draft article has no points of measure on file yet", () => {
    const view = buildMeasurements({ article: bareArticle(), sizes: [], extras: [], mode: "measurement", unit: "mm" });
    expect(view.rows).toEqual([]);
    expect(view.note).toContain("no points of measure on file");
  });
});

describe("Auto-map", () => {
  it("says there is nothing to place when every one of the base's points is already on the table", () => {
    const view = table();
    const plan = autoMapPlan(article(), view.rows);
    expect(plan.letters).toHaveLength(12);
    expect(plan.missing).toEqual([]);
    expect(plan.message).toContain("already on the table");
  });

  it("names the points it would place when the table is empty", () => {
    const plan = autoMapPlan(article(), []);
    expect(plan.missing).toHaveLength(12);
    expect(plan.message).toContain("A, B, C");
  });

  it("says the base article has none to place", () => {
    expect(autoMapPlan(null, []).message).toContain("no standard points of measure");
    expect(autoMapPlan(bareArticle(), []).letters).toEqual([]);
  });
});

describe("the letter an extra point takes", () => {
  it("is the first one the base article does not use", () => {
    expect(nextExtraLetter(article().poms.map((pom) => pom.letter))).toBe("M");
    expect(nextExtraLetter([])).toBe("A");
  });

  it("carries on past Z rather than reusing a letter", () => {
    const all = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
    expect(nextExtraLetter(all)).toBe("Q1");
    expect(nextExtraLetter([...all, "Q1"])).toBe("Q2");
  });
});
