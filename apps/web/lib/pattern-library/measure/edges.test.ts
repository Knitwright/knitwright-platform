import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { measurePattern } from ".";
import { foldFrame, lineNote } from "./frame";
import { capEase, collarReadings } from "./sleeve";

const base = JERSEY_EU48.piecesBySize["48"];
const change = (id: string, f: (p: PatternPiece) => PatternPiece): PatternPiece[] => base.map((p) => (p.id === id ? f(p) : p));
const reasonOf = (pieces: readonly PatternPiece[], id: string) => measurePattern("48", pieces).skipped.find((s) => s.pointId === id)?.reason;

describe("an empty pattern", () => {
  it("gives nothing and says why for every point", () => {
    const { measurements, skipped } = measurePattern("48", []);
    expect(measurements).toEqual([]);
    expect(skipped.length).toBeGreaterThanOrEqual(19);
    expect(reasonOf([], "chest-width")).toBe("This pattern has no front piece.");
    expect(reasonOf([], "shoulder-width")).toBe("This pattern has no back piece.");
    expect(reasonOf([], "armhole-curve")).toContain("need their landmarks");
  });
});

describe("pieces with parts missing", () => {
  it("a back with no fold line", () => {
    const pieces = change("back", (p) => ({ ...p, foldLine: null, onFold: false }));
    expect(reasonOf(pieces, "back-neck-drop")).toBe("The back piece has no fold line to measure from.");
    expect(reasonOf(pieces, "across-back")).toContain("needs a fold line");
  });

  it("a back with no armhole to measure across", () => {
    const pieces = change("back", (p) => ({ ...p, landmarks: { ...p.landmarks, underarm: [9999, 9999] as Point } }));
    expect(reasonOf(pieces, "across-back")).toContain("needs a fold line");
  });

  it("a front missing only some landmarks", () => {
    const pieces = change("front", (p) => ({ ...p, landmarks: Object.fromEntries(Object.entries(p.landmarks).filter(([name]) => name !== "hps")) }));
    expect(reasonOf(pieces, "neck-width")).toContain("hps landmark");
    expect(reasonOf(pieces, "front-neck-drop")).toContain("hps");
  });

  it("a sleeve with no cap seams or no landmarks", () => {
    expect(reasonOf(change("sleeve", (p) => ({ ...p, landmarks: {} })), "upper-arm")).toBe("This pattern has no sleeve piece with its landmarks.");
  });

  it("a front whose fold line is a single point", () => {
    expect(foldFrame({ foldLine: { from: [1, 1], to: [1, 1] } })).toBeNull();
    expect(foldFrame({ foldLine: null })).toBeNull();
  });
});

describe("what a measurement says about its line", () => {
  it("is plain about a sew line, an outline with allowance, one without and one that is not described", () => {
    expect(lineNote({ sewLine: [[0, 0]], outlineKind: "with-seam-allowance" })).toBe("on the sew line");
    expect(lineNote({ sewLine: null, outlineKind: "with-seam-allowance" })).toContain("finished size is smaller");
    expect(lineNote({ sewLine: null, outlineKind: "without-seam-allowance" })).toContain("sewn size");
    expect(lineNote({ sewLine: null, outlineKind: "unknown" })).toContain("does not say");
  });
});

describe("cap ease", () => {
  it("is zero when the cap is a rounding error short, a figure when longer, and skipped when clearly shorter or unknown", () => {
    expect(capEase(480.2, 480.4)).toMatchObject({ mm: 0 });
    expect(capEase(485, 480)).toMatchObject({ mm: 5 });
    expect(capEase(470, 480)).toMatchObject({ pointId: "cap-ease", reason: expect.stringContaining("10.0 mm shorter") });
    expect(capEase(undefined, 480)).toHaveProperty("reason");
    expect(capEase(480, undefined)).toHaveProperty("reason");
  });
});

describe("the collar", () => {
  const collar = base.find((p) => p.id === "collar") as PatternPiece;

  it("is measured without a fold line as plain extents, and the length is not given", () => {
    const set = { size: "48", collar: { ...collar, foldLine: null, onFold: false }, seams: new Map() };
    const [height, length] = collarReadings(set);
    expect(height).toMatchObject({ pointId: "collar-height" });
    expect(length).toMatchObject({ pointId: "collar-cut-length", reason: expect.stringContaining("no fold line") });
  });

  it("is skipped with a reason when there is no collar", () => {
    expect(collarReadings({ size: "48", seams: new Map() }).map((o) => "reason" in o)).toEqual([true, true]);
  });

  it("gives its length not doubled when it is not cut on the fold", () => {
    const [, length] = collarReadings({ size: "48", collar: { ...collar, onFold: false }, seams: new Map() });
    expect(length).toMatchObject({ mm: expect.closeTo(212.9, 0) });
  });
});
