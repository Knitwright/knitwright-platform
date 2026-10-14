import { describe, expect, it } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { apply } from "../geometry/affine";
import { areaOf } from "../geometry/polygon";
import { gradedJersey } from "../fixtures/graded";
import { anchorsFromInstances, frameFor } from "./frame";
import { instancesOf, openOutline } from "./instances";

const base = JERSEY_EU48.piecesBySize["48"] ?? [];
const { instances } = instancesOf(base, "48");
const byId = (id: string) => instances.find((i) => i.id === id)!;

describe("instances", () => {
  it("prints the front, back, both sleeves and the collar", () => {
    expect(instances.map((i) => i.id)).toEqual(["front", "back", "sleeve-left", "sleeve-right", "collar"]);
    expect(byId("sleeve-right").mirrored).toBe(true);
    expect(byId("sleeve-left").pieceName).toMatch(/left/);
    const partial = instancesOf(base, "48", { front: ["front"] });
    expect(partial.instances).toHaveLength(1);
    expect(partial.unplaced).toHaveLength(3);
  });

  it("opens a piece cut on the fold to twice the area, and leaves the others as they are", () => {
    const front = base.find((p) => p.id === "front")!;
    expect(areaOf(openOutline(front))).toBeCloseTo(2 * areaOf(front.cutOutline), -1);
    const sleeve = base.find((p) => p.id === "sleeve")!;
    expect(openOutline(sleeve)).toBe(sleeve.cutOutline);
  });

  it("mirrors the right sleeve about its middle without changing its size", () => {
    expect(areaOf(byId("sleeve-right").opened)).toBeCloseTo(areaOf(byId("sleeve-left").opened), 2);
  });
});

describe("frames", () => {
  const anchors = anchorsFromInstances(instances);

  it("stands the front upright: the neck above the hem, the underarm on the chest line", () => {
    const { toDesign } = frameFor(byId("front"), anchors);
    const lm = byId("front").piece.landmarks;
    const neck = apply(toDesign, lm["cf-neck"]!);
    const hem = apply(toDesign, lm["cf-hem"]!);
    expect(neck[0]).toBeCloseTo(0, 6);
    expect(hem[0]).toBeCloseTo(0, 6);
    expect(neck[1]).toBeLessThan(0);
    expect(hem[1]).toBeGreaterThan(0);
    expect(apply(toDesign, lm.underarm!)[1]).toBeCloseTo(0, 6);
  });

  it("puts the front's and the back's chest lines at the same height, in every size", () => {
    const set = gradedJersey();
    for (const size of set.sizes) {
      const found = instancesOf(set.piecesBySize[size]!, size).instances;
      const heights = ["front", "back"].map((id) => {
        const instance = found.find((i) => i.id === id)!;
        return apply(frameFor(instance, anchors).toDesign, instance.piece.landmarks.underarm!)[1];
      });
      expect(heights[0]).toBeCloseTo(0, 6);
      expect(heights[1]).toBeCloseTo(0, 6);
    }
  });

  it("keeps sizes: a turn and a move only, so a repeat is the same size in every size", () => {
    const { toDesign } = frameFor(byId("front"), anchors);
    const [a, b, c, d] = toDesign;
    expect(Math.hypot(a, b)).toBeCloseTo(1, 9);
    expect(Math.hypot(c, d)).toBeCloseTo(1, 9);
  });

  it("puts the sleeve's underarm on the same chest line as the body", () => {
    for (const id of ["sleeve-left", "sleeve-right"]) {
      const instance = byId(id);
      const { toDesign } = frameFor(instance, anchors);
      const lm = instance.piece.landmarks;
      expect(apply(toDesign, lm["underarm-a"]!)[1]).toBeCloseTo(0, 6);
      expect(apply(toDesign, lm["cap-top"]!)[1]).toBeLessThan(-100);
    }
  });

  it("stands a piece with no landmarks on its fold, and says so", () => {
    const collar = frameFor(byId("collar"), anchors);
    expect(collar.basis).toBe("bounds");
    expect(frameFor(byId("front"), anchors).basis).toBe("landmarks");
  });

  it("falls back to the bounds for a body piece that lacks landmarks", () => {
    const front = byId("front");
    const bare = { ...front, piece: { ...front.piece, landmarks: {} } };
    expect(frameFor(bare, anchors).basis).toBe("bounds");
  });

  it("follows anchors a flat supplies", () => {
    const moved = { front: { underarm: { x: 0, y: 300 }, "cf-neck": { x: 5, y: 0 } } };
    const { toDesign } = frameFor(byId("front"), moved);
    expect(apply(toDesign, byId("front").piece.landmarks.underarm!)[1]).toBeCloseTo(300, 6);
    expect(apply(toDesign, byId("front").piece.landmarks["cf-neck"]!)[0]).toBeCloseTo(5, 6);
  });
});
