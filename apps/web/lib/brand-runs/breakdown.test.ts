import { describe, expect, it } from "vitest";
import { checkBreakdown, MAX_RUN_PIECES, numbersOf } from "./breakdown";

const RUN = ["S", "M", "L", "XL"];
const NO_MOQ = { status: "not-set" } as const;
const check = (over: Partial<Parameters<typeof checkBreakdown>[0]> = {}) =>
  checkBreakdown({ kind: "run", quantities: { S: 20, M: 40, L: 30 }, sizeRun: RUN, moq: { status: "set", value: 50 }, ...over });

describe("checkBreakdown", () => {
  it("adds the pieces and keeps the order of the size run", () => {
    const result = check({ quantities: { L: 30, S: 20, M: 40 } });
    expect(result.total).toBe(90);
    expect(Object.keys(result.sizes)).toEqual(["S", "M", "L"]);
    expect(result.errors).toEqual([]);
    expect(result.flags).toEqual([]);
  });
  it("drops zero and empty sizes", () => {
    const result = check({ quantities: { S: 0, M: 60, L: "", XL: undefined } });
    expect(result.sizes).toEqual({ M: 60 });
  });
  it("refuses a size that is not in the run", () => {
    expect(check({ quantities: { XXS: 60 } }).errors).toContain("Size XXS is not in this design's size run.");
  });
  it("accepts any label when the design has no size run", () => {
    expect(check({ sizeRun: [], quantities: { Q: 60 } }).errors).toEqual([]);
  });
  it("sorts sizes outside the run after it, by label", () => {
    expect(Object.keys(check({ sizeRun: [], quantities: { B: 30, A: 30 } }).sizes)).toEqual(["A", "B"]);
  });
  it.each([[1.5], [-1], ["7"], [100_000], [Number.NaN]])("refuses %s pieces", (bad) => {
    expect(check({ quantities: { M: bad } }).errors).toContain("Size M: use a whole number of pieces.");
  });
  it("refuses an empty breakdown", () => {
    expect(check({ quantities: {} }).errors).toEqual(["Choose at least one size."]);
  });
  it("refuses more than 40 sizes", () => {
    const quantities = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`S${i}`, 1]));
    expect(check({ sizeRun: [], quantities }).errors).toContain("A breakdown can hold at most 40 sizes.");
  });
  it("flags a run under the minimum without refusing it", () => {
    const result = check({ quantities: { M: 20 } });
    expect(result.errors).toEqual([]);
    expect(result.flags.map((f) => f.code)).toEqual(["under_moq"]);
    expect(result.flags[0]!.text).toContain("minimum order of 50");
  });
  it("does not flag a run exactly at the minimum", () => {
    expect(check({ quantities: { M: 50 } }).flags).toEqual([]);
  });
  it("says so when no minimum is set, and invents none", () => {
    const result = check({ moq: NO_MOQ, quantities: { M: 10 } });
    expect(result.flags.map((f) => f.code)).toEqual(["moq_not_set"]);
  });
  it("flags a run over 300", () => {
    const result = check({ quantities: { M: MAX_RUN_PIECES + 1 } });
    expect(result.flags.map((f) => f.code)).toEqual(["over_max"]);
  });
  it("does not flag a run of exactly 300", () => {
    expect(check({ quantities: { M: MAX_RUN_PIECES } }).flags).toEqual([]);
  });
  it("can flag under the minimum and over 300 together", () => {
    const result = check({ moq: { status: "set", value: 400 }, quantities: { M: 350 } });
    expect(result.flags.map((f) => f.code)).toEqual(["under_moq", "over_max"]);
  });
  describe("a sample", () => {
    it("is one piece of each size chosen", () => {
      const result = check({ kind: "sample", quantities: { S: 1, L: 1 } });
      expect(result.total).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.flags).toEqual([]);
    });
    it("refuses more than one piece of a size", () => {
      expect(check({ kind: "sample", quantities: { S: 2 } }).errors).toContain("Size S: a sample is one piece of each size.");
    });
  });
});

describe("numbersOf", () => {
  it("reads whole numbers typed as text, leaves blanks as zero and keeps bad text for the check", () => {
    expect(numbersOf({ S: "12", M: " 3 ", L: "", XL: "1.5", XXL: "abc", XS: 4 })).toEqual({ S: 12, M: 3, L: 0, XL: "1.5", XXL: "abc", XS: 4 });
  });
});
