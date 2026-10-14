import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { offsetOutline, outlineArea } from "@/lib/production/geometry/offset";
import { nearestPointOnOutline } from "./geometry";
import { allowanceMm, offsetEachEdge, OUTLINE_QUESTION, withSeamAllowance } from "./seam-allowance";
import { seamsOf } from "./seams";

const pieces = JERSEY_EU48.piecesBySize["48"];
const piece = (id: string): PatternPiece => pieces.find((p) => p.id === id) as PatternPiece;
const square: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]];

describe("offsetEachEdge", () => {
  it("grows a square by the same distance on every side", () => {
    const grown = offsetEachEdge(square, [6, 6, 6, 6]);
    expect(outlineArea(grown)).toBeCloseTo(112 * 112, 0);
  });

  it("gives each edge its own distance and leaves a fold edge where it is", () => {
    const grown = offsetEachEdge(square, [0, 6, 20, 6]);
    const xs = grown.map((p) => p[0]);
    const ys = grown.map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...xs)).toBeCloseTo(106, 5);
    expect(Math.max(...ys)).toBeCloseTo(120, 5);
    expect(Math.min(...xs)).toBeCloseTo(-6, 5);
  });

  it("works whichever way round the outline runs", () => {
    const ccw = outlineArea(offsetEachEdge(square, [5, 5, 5, 5]));
    const cw = outlineArea(offsetEachEdge([...square].reverse(), [5, 5, 5, 5]));
    expect(cw).toBeCloseTo(ccw, 3);
  });

  it("ignores repeated points", () => {
    const grown = offsetEachEdge([[0, 0], [0, 0], [100, 0], [100, 100], [0, 100]], [3, 3, 3, 3, 3]);
    expect(outlineArea(grown)).toBeCloseTo(106 * 106, 0);
  });

  it("bevels a corner that would reach too far", () => {
    const spike: Point[] = [[0, 0], [100, 0], [0, 4]];
    const grown = offsetEachEdge(spike, [10, 10, 10]);
    expect(grown.length).toBeGreaterThan(3);
    expect(Math.max(...grown.map((p) => Math.abs(p[0])))).toBeLessThan(400);
  });

  it("steps when two parallel edges have different distances", () => {
    const line: Point[] = [[0, 0], [50, 0], [100, 0], [100, 50], [0, 50]];
    const grown = offsetEachEdge(line, [0, 6, 6, 6, 6]);
    expect(grown.length).toBeGreaterThanOrEqual(5);
  });
});

describe("withSeamAllowance", () => {
  it("asks when the file does not say whether the outline holds allowance", () => {
    const result = withSeamAllowance(piece("front"), null);
    expect(result).toEqual({ ok: false, question: OUTLINE_QUESTION });
  });

  it("grows a net outline: bigger, sew line kept, 6 mm at seams, 20 mm at the hem, none at the fold", () => {
    const front = piece("front");
    const result = withSeamAllowance(front, "net");
    if (!result.ok) throw new Error("asked");
    expect(result.piece.sewLine).toEqual(front.cutOutline);
    expect(result.piece.outlineKind).toBe("with-seam-allowance");
    expect(outlineArea(result.piece.cutOutline)).toBeGreaterThan(outlineArea(front.cutOutline));
    const byId = Object.fromEntries(result.piece.seamAllowance.map((a) => [a.seamId, a]));
    expect(byId["side-seam"]).toEqual({ seamId: "side-seam", mm: 6, source: "knitwright-default" });
    expect(byId.hem.mm).toBe(20);
    expect(byId.fold.mm).toBe(0);
    expect(result.derived).toContain("Knitwright default");
    // Away from the corners the cut line lies 6 mm outside the side seam.
    const side = seamsOf([front]).get("front")?.find((s) => s.seamId === "side-seam");
    const middle = side?.points[Math.floor((side?.points.length ?? 0) / 2)] as Point;
    expect(nearestPointOnOutline(result.piece.cutOutline, middle).distance).toBeCloseTo(6, 0);
  });

  it("is a different object, and the input is not changed", () => {
    const front = piece("front");
    const before = JSON.stringify(front);
    const result = withSeamAllowance(front, "net");
    expect(result.ok && result.piece !== front).toBe(true);
    expect(JSON.stringify(front)).toBe(before);
  });

  it("only labels a gross outline, and states no size", () => {
    const result = withSeamAllowance(piece("back"), "gross");
    if (!result.ok) throw new Error("asked");
    expect(result.piece.cutOutline).toEqual(piece("back").cutOutline);
    expect(result.piece.sewLine).toBeNull();
    expect(result.piece.seamAllowance.every((a) => a.mm === null && a.source === "not-stated")).toBe(true);
    expect(result.derived).toBeNull();
  });

  it("takes the file's word when it says what the outline is", () => {
    const stated = { ...piece("front"), outlineKind: "with-seam-allowance" as const };
    expect(withSeamAllowance(stated, "net")).toEqual({ ok: true, piece: stated, derived: null });
    const net = { ...piece("front"), outlineKind: "without-seam-allowance" as const };
    expect(withSeamAllowance(net, null).ok).toBe(true);
  });

  it("falls back to an even allowance when the piece has no landmarks", () => {
    const bare = { ...piece("front"), landmarks: {} };
    const result = withSeamAllowance(bare, "net");
    if (!result.ok) throw new Error("asked");
    expect(result.piece.seamAllowance).toEqual([{ seamId: "all-edges", mm: 6, source: "knitwright-default" }]);
    expect(outlineArea(result.piece.cutOutline)).toBeGreaterThan(outlineArea(bare.cutOutline));
  });

  it("grows the collar, the sleeve and the back too", () => {
    for (const id of ["collar", "sleeve", "back"]) {
      const result = withSeamAllowance(piece(id), "net");
      if (!result.ok) throw new Error("asked");
      expect(outlineArea(result.piece.cutOutline)).toBeGreaterThan(outlineArea(piece(id).cutOutline));
    }
  });

  it("agrees with a plain offset when every edge has the same allowance", () => {
    const a = outlineArea(offsetEachEdge(piece("front").cutOutline, piece("front").cutOutline.map(() => 6)));
    const b = outlineArea(offsetOutline(piece("front").cutOutline, 6, "miter"));
    expect(Math.abs(a - b) / b).toBeLessThan(0.01);
  });

  it("is undone by shrinking by the same distance", () => {
    const grown = offsetEachEdge(piece("front").cutOutline, piece("front").cutOutline.map(() => 6));
    const back = offsetOutline(grown, -6, "miter");
    expect(Math.abs(outlineArea(back) - outlineArea(piece("front").cutOutline)) / outlineArea(piece("front").cutOutline)).toBeLessThan(0.01);
  });
});

describe("allowanceMm", () => {
  it("is the hem size at hems, nothing at a fold and the overlock size elsewhere", () => {
    const choice = { overlockMm: 6, hemMm: 20 };
    expect([allowanceMm("hem", choice), allowanceMm("sleeve-hem", choice), allowanceMm("fold", choice), allowanceMm("shoulder", choice)]).toEqual([20, 20, 0, 6]);
  });
});
