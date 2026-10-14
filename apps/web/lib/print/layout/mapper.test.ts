import { describe, expect, it } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { TEST_BASE_SIZE, TEST_GRADED_JERSEY } from "../fixtures/graded";
import { distance, dot, pointInPolygon } from "../geometry/vec";
import { createLayoutMapper } from "./mapper";

const mapper = createLayoutMapper({ pattern: TEST_GRADED_JERSEY, baseSize: TEST_BASE_SIZE });
const single = createLayoutMapper({ pattern: JERSEY_EU48, baseSize: "48" });

describe("layout mapper", () => {
  it("puts the chest line at the centre front on the fold, at the underarm height", () => {
    const hit = single.toPiece("front", { x: 0, y: 0 }, "48");
    expect(hit?.pieceId).toBe("front");
    expect(hit?.xMm).toBeCloseTo(17.35, 1);
    expect(hit?.yMm).toBeCloseTo(0, 6);
  });
  it("keeps scale at 1 in every size: the repeat does not grade", () => {
    for (const size of TEST_GRADED_JERSEY.sizes) {
      const a = mapper.planeToPiece("front", { x: 10, y: -20 }, size)!;
      const b = mapper.planeToPiece("front", { x: 110, y: 80 }, size)!;
      expect(distance(a, b)).toBeCloseTo(Math.hypot(100, 100), 9);
    }
  });
  it("is a pure rotation when the piece is shown the right way up (no mirroring of artwork)", () => {
    const f = mapper.frame("front", "48")!;
    // Pieces are y-up. Shown on a page (y down) the map must have determinant +1.
    const rightOnPage = [f.right[0], -f.right[1]];
    const downOnPage = [f.down[0], -f.down[1]];
    expect(rightOnPage[0] * downOnPage[1] - rightOnPage[1] * downOnPage[0]).toBeCloseTo(1, 9);
  });
  it("round trips between the design plane and a piece", () => {
    for (const view of ["front", "back", "sleeve-left", "sleeve-right", "collar"] as const) {
      const p = mapper.planeToPiece(view, { x: 123.4, y: 56.7 }, "50")!;
      const back = mapper.pieceToPlane(view, p, "50")!;
      expect(back.x).toBeCloseTo(123.4, 9);
      expect(back.y).toBeCloseTo(56.7, 9);
    }
  });
  it("gives no hit for a point outside the cut outline, and a hit inside", () => {
    expect(mapper.toPiece("front", { x: 0, y: 5000 }, "48")).toBeNull();
    expect(mapper.toPiece("front", { x: 0, y: 100 }, "48")).not.toBeNull();
    expect(mapper.toPiece("front", { x: 0, y: 0 }, "99")).toBeNull();
  });
  it("lays the back beside the front: one chest width of front plus one of back to its centre", () => {
    const [front, back] = [mapper.frame("front", "48")!, mapper.frame("back", "48")!];
    const half = (f: typeof front) => Math.abs(dot([f.opened.landmarks.underarm![0] - f.origin[0], f.opened.landmarks.underarm![1] - f.origin[1]], f.right));
    expect(back.wornOrigin[0]).toBeCloseTo(half(front) + half(back), 6);
    expect(front.wornOrigin).toEqual([0, 0]);
  });
  it("keeps the worn origins the same in every size", () => {
    const a = mapper.frame("back", "44")!.wornOrigin;
    const b = mapper.frame("back", "52")!.wornOrigin;
    expect(a).toEqual(b);
  });
  it("draws both sleeves the same way up, and the left one's outline is the mirror image of the right one's", () => {
    const l = mapper.frame("sleeve-left", "48")!;
    const r = mapper.frame("sleeve-right", "48")!;
    expect(l.pieceId).toBe("sleeve");
    expect(l.right).toEqual(r.right);
    expect(l.wornOrigin[0]).toBeCloseTo(-r.wornOrigin[0], 6);
    const [al, ar] = [mapper.landmarkPlane("sleeve-left", "underarm-a", "48")!, mapper.landmarkPlane("sleeve-right", "underarm-a", "48")!];
    expect(al.x - l.wornOrigin[0]).toBeCloseTo(-(ar.x - r.wornOrigin[0]), 1);
    expect(al.y - l.wornOrigin[1]).toBeCloseTo(ar.y - r.wornOrigin[1], 1);
  });
  it("reports the landmarks of a view on the design plane", () => {
    const hps = mapper.landmarkPlane("front", "hps", "48")!;
    expect(hps.y).toBeLessThan(0);
    expect(mapper.landmarkPlane("front", "cb-neck", "48")).toBeUndefined();
  });
  it("tells where rows agree across the seams, with numbers", () => {
    const a = mapper.rowAgreement("48");
    expect(a.sideSeamMm).toBeCloseTo(0, 6);
    expect(a.shoulderMm).toBeGreaterThan(0);
    expect(a.sleeveShoulderMm).toBeCloseTo(0, 6);
    expect(a.sleeveUnderarmMm).toBeGreaterThan(0);
  });
  it("finds nothing for a view the pattern has no piece for", () => {
    const noCollar = {
      ...JERSEY_EU48,
      piecesBySize: { "48": JERSEY_EU48.piecesBySize["48"].filter((p) => p.id !== "collar") },
    };
    const m = createLayoutMapper({ pattern: noCollar, baseSize: "48" });
    expect(m.frame("collar", "48")).toBeNull();
    expect(m.views("48")).toEqual(["front", "back", "sleeve-left", "sleeve-right"]);
  });
  it("opens the outline so the whole piece is inside it", () => {
    const f = mapper.frame("front", "48")!;
    expect(pointInPolygon([0, 0], f.opened.outline)).toBe(true);
    expect(pointInPolygon([0, 100], f.opened.outline)).toBe(true);
  });
});
