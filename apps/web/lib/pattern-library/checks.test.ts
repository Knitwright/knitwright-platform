import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { checkSize, refusals, SEAM_TOLERANCE_MM } from "./checks";
import { addNotches } from "./notches";

const base = JERSEY_EU48.piecesBySize["48"];
const only = (results: ReturnType<typeof checkSize>, id: string) => results.filter((r) => r.id === id);
const swap = (id: string, change: (p: PatternPiece) => PatternPiece): PatternPiece[] => base.map((p) => (p.id === id ? change(p) : p));

describe("the benchmark pieces", () => {
  const results = checkSize("48", base);

  it("close, have grain lines, find their landmarks and have seams that agree", () => {
    expect(results.filter((r) => r.level === "refuse").every((r) => r.ok)).toBe(true);
    expect(only(results, "seam-side")[0].sentence).toBe("Side seams: front 484.6 mm and back 484.6 mm agree (within 2 mm).");
    expect(only(results, "seam-shoulder")[0].ok).toBe(true);
    expect(refusals(results)).toEqual([]);
  });

  it("note that the sleeve is sewn in without ease", () => {
    expect(only(results, "ease")[0]).toMatchObject({ ok: true, level: "note" });
    expect(only(results, "ease")[0].sentence).toContain("no ease");
  });

  it("warn that the file does not say about seam allowance and has no notches", () => {
    expect(only(results, "seam-allowance")[0]).toMatchObject({ ok: false, level: "warn" });
    expect(only(results, "seam-allowance")[0].sentence).toContain("does not say whether the outline holds seam allowance");
    expect(only(results, "notches")[0].sentence).toContain("No notch on:");
    expect(only(results, "notches")[0].sentence).toContain("torso front (armhole-front)");
  });

  it("are satisfied about the notches once they are added", () => {
    const notched = addNotches(base).pieces;
    expect(only(checkSize("48", notched), "notches")[0]).toMatchObject({ ok: true, sentence: "Every joined seam has a notch." });
  });
});

describe("what is refused", () => {
  it("an outline that crosses itself or has no area", () => {
    const bow = swap("collar", (p) => ({ ...p, cutOutline: [[0, 0], [10, 10], [20, 0], [20, 10], [0, 10]] as Point[] }));
    expect(refusals(checkSize("48", bow)).map((r) => r.sentence)).toEqual(["collar: the outline crosses itself."]);
    const flat = swap("collar", (p) => ({ ...p, cutOutline: [[0, 0], [10, 0], [20, 0]] as Point[] }));
    expect(refusals(checkSize("48", flat))[0].sentence).toBe("collar: the outline does not close or has no area.");
  });

  it("side seams or shoulder seams that differ by more than 2 mm, naming the seam and the size", () => {
    const stretched = swap("back", (p) => ({ ...p, cutOutline: p.cutOutline.map((pt, i) => (i === 64 ? ([pt[0] - 3, pt[1]] as Point) : pt)), landmarks: { ...p.landmarks, "side-hem": [p.landmarks["side-hem"]![0] - 3, p.landmarks["side-hem"]![1]] as Point } }));
    const refused = refusals(checkSize("M", stretched));
    expect(refused).toHaveLength(1);
    expect(refused[0].id).toBe("seam-side");
    expect(refused[0].sentence).toMatch(/^Side seams, size M: the front is 484\.6 mm and the back is 48\d\.\d mm, [23]\.\d mm apart\. They must agree within 2 mm to sew together\.$/);
    expect(SEAM_TOLERANCE_MM).toBe(2);
  });

  it("seams that cannot be compared are a warning, not a refusal", () => {
    const bare = swap("back", (p) => ({ ...p, landmarks: {} }));
    const results = checkSize("48", bare);
    expect(only(results, "seam-side")[0]).toMatchObject({ ok: false, level: "warn" });
    expect(only(results, "seam-side")[0].sentence).toContain("could not be compared");
    expect(only(results, "landmarks-back")[0].sentence).toContain("could not find cb-neck");
  });
});

describe("the warnings", () => {
  it("a piece with no grain line", () => {
    const results = checkSize("48", swap("front", (p) => ({ ...p, grainLine: null })));
    expect(only(results, "grain-front")[0]).toMatchObject({ ok: false, level: "warn" });
    expect(only(results, "grain-front")[0].sentence).toContain("has no grain line");
  });

  it("a number to cut that looks wrong", () => {
    const once = checkSize("48", swap("sleeve", (p) => ({ ...p, quantity: 1, mirroredPair: false })));
    expect(only(once, "quantity-sleeve")[0].ok).toBe(false);
    expect(only(once, "quantity-sleeve")[0].sentence).toContain("1 time");
    const many = checkSize("48", swap("front", (p) => ({ ...p, quantity: 4 })));
    expect(only(many, "quantity-front")[0].sentence).toContain("4 times");
    expect(only(checkSize("48", base), "quantity-front")[0].sentence).toBe("torso front: the number to cut looks right (1).");
  });

  it("a sleeve cap longer or shorter than the armholes", () => {
    const longer = swap("sleeve", (p) => ({ ...p, cutOutline: p.cutOutline.map((pt) => (pt[0] > -100 ? ([pt[0] + 4, pt[1]] as Point) : pt)), landmarks: { ...p.landmarks, "cap-top": [p.landmarks["cap-top"]![0] + 4, p.landmarks["cap-top"]![1]] as Point } }));
    expect(only(checkSize("48", longer), "ease")[0].sentence).toMatch(/longer than the armholes/);
    const shorter = swap("sleeve", (p) => ({ ...p, cutOutline: p.cutOutline.map((pt) => (pt[0] > -100 ? ([pt[0] - 4, pt[1]] as Point) : pt)), landmarks: { ...p.landmarks, "cap-top": [p.landmarks["cap-top"]![0] - 4, p.landmarks["cap-top"]![1]] as Point } }));
    expect(only(checkSize("48", shorter), "ease")[0].sentence).toMatch(/shorter than the armholes .* stretched in/);
  });

  it("says nothing about ease when there is no sleeve", () => {
    expect(only(checkSize("48", base.filter((p) => p.id !== "sleeve")), "ease")).toEqual([]);
  });
});
