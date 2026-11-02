import { describe, expect, it } from "vitest";
import { because, gap, GAP_RULE_ID, held, isGap, listOf } from "./gap";

/**
 * The gap. What matters here is what a gap does **not** carry: a Store handed a null in place of a
 * figure renders the null, and this is the shape that makes that impossible.
 */

const VALUE_SHAPED = /value|date|amount|minor|price|qty|quantity|figure|total|on$|at$/i;

describe("a gap", () => {
  it("says it is a gap, names what is missing and carries a rule that explains it", () => {
    const missing = gap(["the days for QC"], "no date exists.", "R-QC-001");

    expect(missing.status).toBe("gap");
    expect(missing.missing).toEqual(["the days for QC"]);
    expect(missing.ruleId).toBe("R-QC-001");
    expect(isGap(missing)).toBe(true);
  });

  it("uses R-GAP-000 where the rulebook has no entry, rather than nothing", () => {
    expect(gap(["x"], "y").ruleId).toBe(GAP_RULE_ID);
  });

  it("carries no value-shaped field and no null at all, which is the whole point of it", () => {
    const missing = gap(["the freight days"], "no date exists.");

    expect(Object.keys(missing).filter((key) => VALUE_SHAPED.test(key))).toEqual([]);
    expect(Object.values(missing).some((value) => value === null)).toBe(false);
    expect(JSON.stringify(missing)).not.toContain("null");
  });

  it("refuses to be built with nothing missing, because that would say nothing", () => {
    expect(() => gap([], "y")).toThrow(/names what is missing/);
  });

  it("refuses a rule id that is not shaped like one, so a typo cannot reach a reader", () => {
    expect(() => gap(["x"], "y", "QC-1")).toThrow(/R-TOPIC-001/);
  });
});

describe("a held value", () => {
  it("is tagged the same way, so one check tells the two apart", () => {
    const value = held({ unitMinor: 2900 });

    expect(value.status).toBe("held");
    expect(value.unitMinor).toBe(2900);
    expect(isGap(value)).toBe(false);
  });
});

describe("the words a gap is written in", () => {
  it("joins a list the way the rest of the platform does", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["one"])).toBe("one");
    expect(listOf(["one", "two"])).toBe("one and two");
    expect(listOf(["one", "two", "three"])).toBe("one, two and three");
  });

  it("builds one sentence a reader can be shown", () => {
    expect(because(["the days for QC", "the freight days"], "no delivery date exists.")).toBe(
      "Knitwright holds no figure for the days for QC and the freight days, so no delivery date exists.",
    );
  });
});
