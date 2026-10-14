import { describe, expect, it } from "vitest";
import type { PatternPiece } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { addNotches, notchOffLine } from "./notches";
import { withSeamAllowance } from "./seam-allowance";
import { seamsOf } from "./seams";

const pieces = JERSEY_EU48.piecesBySize["48"];
const get = (set: readonly PatternPiece[], id: string): PatternPiece => set.find((p) => p.id === id) as PatternPiece;

describe("addNotches", () => {
  const { pieces: notched, derived } = addNotches(pieces);

  it("puts one notch on each joined seam of the front and two on the back", () => {
    expect(get(notched, "front").notches.map((n) => [n.seamId, n.count]).sort()).toEqual([
      ["armhole-front", 1], ["neckline-front", 1], ["shoulder", 1], ["side-seam", 1],
    ]);
    expect(get(notched, "back").notches.map((n) => [n.seamId, n.count]).sort()).toEqual([
      ["armhole-back", 2], ["neckline-back", 2], ["shoulder", 2], ["side-seam", 2],
    ]);
  });

  it("marks the sleeve cap halves with the front and back armhole counts, and the underarm seams", () => {
    const sleeve = get(notched, "sleeve");
    expect(sleeve.notches.filter((n) => n.seamId === "armhole-front").map((n) => n.count)).toEqual([1]);
    expect(sleeve.notches.filter((n) => n.seamId === "armhole-back").map((n) => n.count)).toEqual([2]);
    expect(sleeve.notches.filter((n) => n.seamId === "sleeve-underarm")).toHaveLength(2);
  });

  it("marks the shoulder positions on both long edges of the collar, scaled from the necklines", () => {
    const collar = get(notched, "collar");
    expect(collar.notches).toHaveLength(2);
    const seams = seamsOf(pieces);
    const back = seams.get("back")?.find((s) => s.seamId === "neckline-back")?.lengthMm as number;
    const front = seams.get("front")?.find((s) => s.seamId === "neckline-front")?.lengthMm as number;
    const edge = seams.get("collar")?.find((s) => s.seamId === "collar-neckline")?.lengthMm as number;
    const distanceFromFold = Math.min(...collar.notches.map((n) => n.at[1]));
    expect(distanceFromFold).toBeCloseTo((back / (front + back)) * edge, 0);
  });

  it("lies on the outline, and says what it added", () => {
    for (const piece of notched) for (const notch of piece.notches) expect(notchOffLine(piece, notch)).toBeLessThan(0.02);
    expect(derived.length).toBeGreaterThan(0);
    expect(derived[0]).toContain("added by Knitwright");
  });

  it("matches the front armhole and its sleeve half at the same share of the way along", () => {
    const seams = seamsOf(pieces);
    const share = (pieceId: string, seamId: string, notches: readonly PatternPiece["notches"][number][]) => {
      const seam = seams.get(pieceId)?.find((s) => s.seamId === seamId);
      const mark = notches.find((n) => n.seamId === seamId);
      if (!seam || !mark) throw new Error("missing");
      let along = 0;
      for (let i = 1; i < seam.points.length; i += 1) {
        const [a, b] = [seam.points[i - 1], seam.points[i]];
        const onSegment = Math.abs(Math.hypot(mark.at[0] - a[0], mark.at[1] - a[1]) + Math.hypot(b[0] - mark.at[0], b[1] - mark.at[1]) - Math.hypot(b[0] - a[0], b[1] - a[1])) < 0.05;
        if (onSegment) return (along + Math.hypot(mark.at[0] - a[0], mark.at[1] - a[1])) / seam.lengthMm;
        along += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      return NaN;
    };
    expect(share("front", "armhole-front", get(notched, "front").notches)).toBeCloseTo(0.5, 1);
    expect(share("sleeve", "armhole-front", get(notched, "sleeve").notches)).toBeCloseTo(0.5, 1);
  });

  it("keeps notches a file already has and does not change its input", () => {
    const keep = { ...get(pieces, "front"), notches: [{ seamId: "shoulder", at: [171.18, 191.45] as [number, number], count: 1 }] };
    const out = addNotches([keep, ...pieces.filter((p) => p.id !== "front")]).pieces;
    expect(get(out, "front")).toBe(keep);
    expect(pieces.every((p) => p.notches.length === 0)).toBe(true);
  });

  it("puts the marks on the cut line when the piece has a sew line", () => {
    const grown = pieces.map((p) => {
      const r = withSeamAllowance(p, "net");
      return r.ok ? r.piece : p;
    });
    const { pieces: out } = addNotches(grown);
    for (const piece of out) for (const notch of piece.notches) expect(notchOffLine(piece, notch)).toBeLessThan(0.02);
    expect(get(out, "front").notches.length).toBe(4);
  });

  it("adds no collar marks without both necklines, and nothing for an unknown piece", () => {
    const alone = addNotches([get(pieces, "collar"), { ...get(pieces, "front"), id: "pocket", landmarks: {} }]);
    expect(alone.pieces.every((p) => p.notches.length === 0)).toBe(true);
  });
});
