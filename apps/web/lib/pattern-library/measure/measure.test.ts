import { describe, expect, it } from "vitest";
import { TOPS_POINTS_OF_MEASURE } from "@/lib/garment/registry/tops/points-of-measure";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";
import { compareToTargets, measurePattern, PATTERN_ONLY_IDS, TOPS_POINT_IDS } from ".";

const cmOf = (set: typeof JERSEY_EU48, id: string): number => {
  const found = measurePattern("48", set.piecesBySize["48"]).measurements.find((m) => m.pointId === id);
  if (!found) throw new Error(`no ${id}`);
  return found.tenthsMm / 100;
};

describe("measuring the benchmark jersey", () => {
  it.each([
    ["body-length", 72.0], ["shoulder-width", 39.0], ["neck-width", 18.8], ["front-neck-drop", 9.6], ["back-neck-drop", 2.6],
    ["chest-width", 50.7], ["hem-width", 51.9], ["sleeve-length", 20.5], ["upper-arm", 18.6], ["cap-height", 13.8],
    ["sleeve-opening", 17.3], ["armhole-curve", 48.0], ["cap-curve", 48.0], ["neckline-length", 50.1], ["collar-height", 3.8], ["collar-cut-length", 42.6],
  ])("%s is %s cm to within 1 mm", (id, expected) => {
    expect(Math.abs(cmOf(JERSEY_EU48, id) - expected)).toBeLessThanOrEqual(0.1);
  });

  it("gives the cap ease as zero to a tenth of a millimetre", () => {
    expect(cmOf(JERSEY_EU48, "cap-ease")).toBeLessThan(0.05);
  });

  it("measures the tee's different values", () => {
    expect(Math.abs(cmOf(TEE_EU48, "body-length") - 68.7)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(cmOf(TEE_EU48, "collar-height") - 4.2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(cmOf(TEE_EU48, "collar-cut-length") - 38.2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(cmOf(TEE_EU48, "neckline-length") - 51.0)).toBeLessThanOrEqual(0.15);
  });

  it("names every registry point and every pattern-only point, none left to confirm", () => {
    const { measurements, skipped } = measurePattern("48", JERSEY_EU48.piecesBySize["48"]);
    const named = new Set([...measurements.map((m) => m.pointId), ...skipped.map((s) => s.pointId)]);
    for (const point of TOPS_POINTS_OF_MEASURE) expect(named.has(point.id)).toBe(true);
    expect([...TOPS_POINT_IDS].sort()).toEqual(TOPS_POINTS_OF_MEASURE.map((p) => p.id).sort());
    for (const id of PATTERN_ONLY_IDS) expect(named.has(id)).toBe(true);
    expect(skipped.map((s) => s.pointId).sort()).toEqual(["placket-length", "placket-width"]);
    expect(measurements.every((m) => m.source === "measured-from-pattern" && m.method.length > 10)).toBe(true);
    expect(measurements.map((m) => m.pointId)).toHaveLength(new Set(measurements.map((m) => m.pointId)).size);
  });

  it("says the outline is as drawn, because the file does not say if it holds allowance", () => {
    const body = measurePattern("48", JERSEY_EU48.piecesBySize["48"]).measurements.find((m) => m.pointId === "chest-width");
    expect(body?.method).toContain("does not say whether it holds seam allowance");
  });

  it("skips what a missing piece would give, with a reason", () => {
    const sleeveless = JERSEY_EU48.piecesBySize["48"].filter((p) => p.id !== "sleeve" && p.id !== "collar");
    const { skipped, measurements } = measurePattern("48", sleeveless);
    expect(skipped.map((s) => s.pointId)).toEqual(expect.arrayContaining(["sleeve-length", "cap-curve", "collar-height", "cap-ease"]));
    expect(measurements.some((m) => m.pointId === "chest-width")).toBe(true);
    expect(skipped.find((s) => s.pointId === "upper-arm")?.reason).toMatch(/no sleeve/);
  });

  it("skips torso points when a piece has no fold line or landmarks", () => {
    const pieces = JERSEY_EU48.piecesBySize["48"].map((p) => (p.id === "front" ? { ...p, foldLine: null, onFold: false, landmarks: {} } : p));
    const { skipped } = measurePattern("48", pieces);
    expect(skipped.find((s) => s.pointId === "chest-width")?.reason).toMatch(/fold line/);
    expect(skipped.find((s) => s.pointId === "armhole")?.reason).toMatch(/underarm/);
    const bare = JERSEY_EU48.piecesBySize["48"].map((p) => (p.id === "front" ? { ...p, landmarks: {} } : p));
    expect(measurePattern("48", bare).skipped.find((s) => s.pointId === "body-length")?.reason).toMatch(/landmark/);
  });
});

describe("what the benchmark's document says against its own pattern", () => {
  // The stated values of Football_Jersey_No10_EU48_TechPack.pdf, in tenths of a millimetre.
  const STATED = [
    { pointId: "hem-width", label: "Hem width", tenthsMm: 5050, toleranceTenthsMm: 100 },
    { pointId: "sleeve-length", label: "Sleeve length", tenthsMm: 2160, toleranceTenthsMm: 50 },
    { pointId: "upper-arm", label: "Bicep", tenthsMm: 1930, toleranceTenthsMm: 50 },
    { pointId: "cap-height", label: "Sleeve cap height", tenthsMm: 1450, toleranceTenthsMm: 30 },
    { pointId: "chest-width", label: "Chest", tenthsMm: 5050, toleranceTenthsMm: 100 },
  ] as const;

  it("catches the four values that differ, by 1.4 / 1.1 / 0.7 / 0.7 cm", () => {
    const rows = compareToTargets(STATED, measurePattern("48", JERSEY_EU48.piecesBySize["48"]).measurements);
    const off = rows.filter((r) => r.within === false);
    expect(off.map((r) => r.pointId)).toEqual(["hem-width", "sleeve-length", "upper-arm", "cap-height"]);
    const shown = off.map((r) => (Math.abs(r.differenceTenthsMm ?? 0) / 100).toFixed(1));
    expect(shown).toEqual(["1.4", "1.1", "0.7", "0.7"]);
    expect(off[0].sentence).toContain("It differs from the pattern by 1.4 cm");
    expect(rows.find((r) => r.pointId === "chest-width")?.sentence).toContain("agree");
  });

  it("says plainly when the pattern cannot give a figure", () => {
    const [row] = compareToTargets([{ pointId: "waist", label: "Waist", tenthsMm: 5000, toleranceTenthsMm: 50 }], []);
    expect(row.within).toBeNull();
    expect(row.sentence).toContain("does not give this measurement");
  });
});
