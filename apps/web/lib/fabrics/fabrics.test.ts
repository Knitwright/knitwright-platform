import { describe, expect, it } from "vitest";
import { fabricProfileSchema, printScale } from "@/lib/production/contract";
import { EMPTY_PROFILE, profileWithTests, type FabricTest } from "./profile";
import { describePrintScale, printScaleFor } from "./print-scale";
import { BENCHMARK_FABRICS } from "./seed";
import { fabricInputSchema, fabricTestInputSchema, sizeMapEntrySchema } from "./schemas";
import { profileFromSheet, readStoredProfile } from "./sheet";
import { REDUCTION_TOLERANCE_POINTS, stretchReduction } from "./stretch";

const test = (over: Partial<FabricTest>): FabricTest => ({
  id: "t1",
  fabricId: "f1",
  testedBy: "Priya Nair",
  testedOn: "2026-10-01",
  method: "Pressed 40 seconds at 200 C.",
  loadNewtons: null,
  stretchLengthPct: null,
  stretchWidthPct: null,
  recoveryPct: null,
  shrinkLengthPct: null,
  shrinkWidthPct: null,
  pressTempC: null,
  pressSeconds: null,
  reductionPct: null,
  photoFileIds: [],
  createdAt: "2026-10-01T10:00:00Z",
  ...over,
});

describe("EMPTY_PROFILE", () => {
  it("is a valid profile with nothing set", () => {
    expect(fabricProfileSchema.safeParse(EMPTY_PROFILE).success).toBe(true);
    expect(Object.values(EMPTY_PROFILE).every((v) => v.source === "not-set")).toBe(true);
  });
});

describe("the benchmark fabrics", () => {
  it("are the three the benchmark names, every number not set", () => {
    expect(BENCHMARK_FABRICS.map((f) => f.name)).toEqual(["Recycled polyester interlock", "Polyester birdseye mesh", "Polyester 1x1 rib"]);
    for (const f of BENCHMARK_FABRICS) {
      expect(Object.values(f.supplier)).toEqual([]);
      expect(fabricInputSchema.safeParse(f).success).toBe(true);
    }
  });
});

describe("profileFromSheet and readStoredProfile", () => {
  it("marks what the sheet states as supplier sheet and the rest as not set", () => {
    const p = profileFromSheet({ gsm: 140, usableWidthMm: 1600 });
    expect(p.gsm).toEqual({ value: 140, source: "supplier-sheet" });
    expect(p.shrinkLengthPct).toEqual({ value: null, source: "not-set" });
    expect(fabricProfileSchema.safeParse(p).success).toBe(true);
  });
  it("reads a stored profile back and falls back to empty for rubbish", () => {
    const p = profileFromSheet({ gsm: 140 });
    expect(readStoredProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(readStoredProfile({ nonsense: true })).toEqual(EMPTY_PROFILE);
    expect(readStoredProfile(null)).toEqual(EMPTY_PROFILE);
  });
});

describe("profileWithTests", () => {
  it("makes a tested value 'fabric-test' and names the test", () => {
    const { profile } = profileWithTests(EMPTY_PROFILE, [test({ shrinkLengthPct: 2, shrinkWidthPct: 1.5, pressTempC: 200, pressSeconds: 40 })]);
    expect(profile.shrinkLengthPct).toEqual({ value: 2, source: "fabric-test", testId: "t1" });
    expect(profile.shrinkWidthPct).toEqual({ value: 1.5, source: "fabric-test", testId: "t1" });
    expect(profile.stretchWidthPct.source).toBe("not-set");
    expect(fabricProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("gives the print scale 1.0204 by 1.0152 for the 2.0 and 1.5 % shrink of the plan", () => {
    const { profile } = profileWithTests(EMPTY_PROFILE, [test({ shrinkLengthPct: 2, shrinkWidthPct: 1.5 })]);
    const scale = printScaleFor(profile);
    expect(scale.length).toBeCloseTo(1.0204, 4);
    expect(scale.width).toBeCloseTo(1.0152, 4);
    expect(scale.notScaled).toBe(false);
    expect(scale).toEqual(printScale(profile));
  });

  it("gives a scale of 1 and 'not scaled for shrink' with no test", () => {
    const scale = printScaleFor(profileWithTests(EMPTY_PROFILE, []).profile);
    expect(scale).toMatchObject({ length: 1, width: 1, notScaled: true });
    expect(scale.note).toMatch(/not scaled for shrink/i);
  });

  it("prefers the newest test that measured the value, whatever order they arrive in", () => {
    const old = test({ id: "a", testedOn: "2026-01-01", shrinkLengthPct: 5 });
    const mid = test({ id: "b", testedOn: "2026-06-01", shrinkLengthPct: 3 });
    const newest = test({ id: "c", testedOn: "2026-09-01", stretchWidthPct: 12, loadNewtons: 10 });
    const { profile } = profileWithTests(EMPTY_PROFILE, [mid, newest, old]);
    expect(profile.shrinkLengthPct).toMatchObject({ value: 3, testId: "b" });
    expect(profile.stretchWidthPct).toMatchObject({ value: 12, testId: "c" });
  });

  it("breaks a tie on the day by when it was saved, then by id", () => {
    const a = test({ id: "a", createdAt: "2026-10-01T09:00:00Z", shrinkLengthPct: 1 });
    const b = test({ id: "b", createdAt: "2026-10-01T11:00:00Z", shrinkLengthPct: 2 });
    expect(profileWithTests(EMPTY_PROFILE, [a, b]).profile.shrinkLengthPct.value).toBe(2);
    const c = test({ id: "c", shrinkLengthPct: 7 });
    const d = test({ id: "d", shrinkLengthPct: 8 });
    expect(profileWithTests(EMPTY_PROFILE, [c, d]).profile.shrinkLengthPct.value).toBe(8);
  });

  it("keeps the supplier's value where no test measured it", () => {
    const sheet = profileFromSheet({ gsm: 140, shrinkLengthPct: 4 });
    const { profile } = profileWithTests(sheet, [test({ stretchWidthPct: 20, loadNewtons: 10 })]);
    expect(profile.gsm.value).toBe(140);
    expect(profile.shrinkLengthPct).toEqual({ value: 4, source: "supplier-sheet" });
  });

  it("carries the tested reduction and says which test", () => {
    const { reduction } = profileWithTests(EMPTY_PROFILE, [test({ reductionPct: 2 })]);
    expect(reduction).toEqual({ value: 2, source: "fabric-test", testId: "t1" });
    expect(profileWithTests(EMPTY_PROFILE, []).reduction.source).toBe("not-set");
  });

  it("does not change what it is given", () => {
    const tests = [test({ shrinkLengthPct: 2 }), test({ id: "z", shrinkLengthPct: 3, testedOn: "2026-02-02" })];
    const copy = structuredClone(tests);
    profileWithTests(EMPTY_PROFILE, tests);
    expect(tests).toEqual(copy);
  });
});

describe("describePrintScale", () => {
  it("states both scales when a test gave them", () => {
    const s = describePrintScale(printScaleFor(profileWithTests(EMPTY_PROFILE, [test({ shrinkLengthPct: 2, shrinkWidthPct: 1.5 })]).profile));
    expect(s).toMatch(/1\.0204/);
    expect(s).toMatch(/1\.0152/);
  });
  it("gives the margin note when nothing scales", () => {
    expect(describePrintScale(printScaleFor(EMPTY_PROFILE))).toMatch(/^Not scaled for shrink/);
  });
  it("says which side is scaled when only one is tested", () => {
    const s = describePrintScale(printScaleFor(profileWithTests(EMPTY_PROFILE, [test({ shrinkLengthPct: 2 })]).profile));
    expect(s).toMatch(/Not scaled for shrink/);
    expect(s).toMatch(/1\.0204/);
  });
});

describe("stretchReduction", () => {
  const withWidth = (pct: number, reduction: number | null = null) =>
    profileWithTests(EMPTY_PROFILE, [test({ stretchWidthPct: pct, loadNewtons: 10, reductionPct: reduction })]);

  it("says there is nothing to compare with when the fabric has no stretch value", () => {
    const r = stretchReduction(profileWithTests(EMPTY_PROFILE, []), { pct: 5 });
    expect(r.status).toBe("no-stretch-value");
    expect(r.warnings[0]).toMatch(/no stretch value/);
  });

  it("matches when the fabric stretches four times the reduction or more and no test disagrees", () => {
    const r = stretchReduction(withWidth(22), { pct: 5 });
    expect(r).toMatchObject({ status: "matches", warnings: [], testedReductionPct: null });
  });

  it("warns when the block takes out more than the fabric can stretch", () => {
    const r = stretchReduction(withWidth(3), { pct: 5 });
    expect(r.status).toBe("beyond-stretch");
    expect(r.warnings[0]).toMatch(/only stretches 3 % across/);
  });

  it("warns when the fabric stretches less than the benchmark's rule of four times", () => {
    const r = stretchReduction(withWidth(12), { pct: 5 });
    expect(r.status).toBe("differs");
    expect(r.warnings[0]).toMatch(/about 20 % across/);
  });

  it("warns when the test found a different reduction right", () => {
    const r = stretchReduction(withWidth(30, 2), { pct: 5 });
    expect(r.status).toBe("differs");
    expect(r.testedReductionPct).toBe(2);
    expect(r.warnings.join(" ")).toMatch(/reduced by 5 %.*found 2 % right/);
  });

  it("is quiet when the block's reduction is within the tolerance of the test", () => {
    const r = stretchReduction(withWidth(30, 5 + REDUCTION_TOLERANCE_POINTS), { pct: 5 });
    expect(r.status).toBe("matches");
  });

  it("compares with a tested reduction even when no stretch was measured", () => {
    const r = stretchReduction(profileWithTests(EMPTY_PROFILE, [test({ reductionPct: 0 })]), { pct: 5 });
    expect(r.status).toBe("differs");
    expect(r.warnings).toHaveLength(1);
  });

  it("gives both warnings when both apply", () => {
    const r = stretchReduction(withWidth(3, 1), { pct: 5 });
    expect(r.status).toBe("beyond-stretch");
    expect(r.warnings).toHaveLength(2);
  });

  it("ignores a stretch that is only a suggestion", () => {
    const fabric = { profile: { ...EMPTY_PROFILE, stretchWidthPct: { value: 1, source: "suggested" as const } }, reduction: EMPTY_PROFILE.recoveryPct };
    expect(stretchReduction(fabric, { pct: 5 }).status).toBe("no-stretch-value");
  });
});

describe("input schemas", () => {
  const goodTest = { testedBy: "Priya Nair", testedOn: "2026-10-01", method: "Pressed 40 s at 200 C", shrinkLengthPct: "2", shrinkWidthPct: "1.5", pressTempC: "200", pressSeconds: "40" };

  it("reads a fabric test typed into a form, numbers as text", () => {
    const r = fabricTestInputSchema.parse(goodTest);
    expect(r.shrinkLengthPct).toBe(2);
    expect(r.photoFileIds).toEqual([]);
  });

  it("needs the load for stretch and the temperature and time for shrink", () => {
    expect(fabricTestInputSchema.safeParse({ ...goodTest, pressTempC: "" }).success).toBe(false);
    expect(fabricTestInputSchema.safeParse({ ...goodTest, shrinkLengthPct: "", shrinkWidthPct: "", stretchWidthPct: "20" }).success).toBe(false);
    expect(fabricTestInputSchema.safeParse({ ...goodTest, shrinkLengthPct: "", shrinkWidthPct: "", stretchWidthPct: "20", loadNewtons: "10" }).success).toBe(true);
  });

  it("needs at least one result", () => {
    const r = fabricTestInputSchema.safeParse({ testedBy: "Priya Nair", testedOn: "2026-10-01", method: "x" });
    expect(r.success).toBe(false);
  });

  it("refuses a placeholder name, an impossible date and a shrink of 40 %", () => {
    expect(fabricTestInputSchema.safeParse({ ...goodTest, testedBy: "TBC" }).success).toBe(false);
    expect(fabricTestInputSchema.safeParse({ ...goodTest, testedOn: "2026-02-31" }).success).toBe(false);
    expect(fabricTestInputSchema.safeParse({ ...goodTest, testedOn: "yesterday" }).success).toBe(false);
    expect(fabricTestInputSchema.safeParse({ ...goodTest, shrinkLengthPct: "40" }).success).toBe(false);
  });

  it("accepts a tested reduction alone", () => {
    expect(fabricTestInputSchema.safeParse({ testedBy: "Priya Nair", testedOn: "2026-10-01", method: "x", reductionPct: "3" }).success).toBe(true);
  });

  it("reads a fabric with an optional sheet", () => {
    const f = fabricInputSchema.parse({ name: " Interlock ", supplier: { gsm: "140", usableWidthMm: "" } });
    expect(f.name).toBe("Interlock");
    expect(f.supplier).toEqual({ gsm: 140 });
    expect(fabricInputSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("reads a size map entry as typed by a person", () => {
    expect(sizeMapEntrySchema.parse({ label: "M", wearer: "men", cut: "mens", patternSize: "48" }).source).toBe("user-edited");
    expect(sizeMapEntrySchema.safeParse({ label: "M", wearer: "men", cut: "mens", patternSize: "" }).success).toBe(false);
    expect(sizeMapEntrySchema.safeParse({ label: "M", wearer: "men", cut: "mens", patternSize: "48", source: "suggested" }).success).toBe(false);
  });
});

import { fabricFormSchema, fabricTestFormSchema } from "./schemas";

describe("form schemas", () => {
  it("reads the add-a-fabric form's flat fields into a fabric with a supplier sheet", () => {
    const f = fabricFormSchema.parse({ name: "Mesh", gsm: "120", usableWidthMm: "", shrinkLengthPct: "3" });
    expect(f).toEqual({ name: "Mesh", composition: "", construction: "", notes: "", supplier: { gsm: 120, shrinkLengthPct: 3 } });
  });

  it("reads the add-a-test form with its fabric id", () => {
    const r = fabricTestFormSchema.parse({ fabricId: "11111111-1111-4111-8111-111111111111", testedBy: "Priya Nair", testedOn: "2026-10-01", method: "x", reductionPct: "3" });
    expect(r.fabricId).toBe("11111111-1111-4111-8111-111111111111");
    expect(r.reductionPct).toBe(3);
    expect(fabricTestFormSchema.safeParse({ fabricId: "nope", testedBy: "Priya Nair", testedOn: "2026-10-01", method: "x", reductionPct: "3" }).success).toBe(false);
  });
});
