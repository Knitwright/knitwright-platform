import { describe, expect, it } from "vitest";
import { IDENTITY, apply, compose, determinant, invert, reflectionAcross, rotation, scaling, translation } from "./affine";
import { intersectRings, mergeRings, subtractRings } from "./clip";
import { areaOf, boundsOf, boxRing, boxesOverlap, circleRing, growBox, pointInRing, ringWithin, round2, signedArea, turnedRect } from "./polygon";

const near = (a: readonly [number, number], b: readonly [number, number], eps = 1e-9) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
  void eps;
};

describe("affine", () => {
  it("rotates counter-clockwise and undoes it", () => {
    const turn = rotation(Math.PI / 2);
    near(apply(turn, [1, 0]), [0, 1]);
    near(apply(invert(turn), [0, 1]), [1, 0]);
  });

  it("composes with the first transform applied first", () => {
    const both = compose(translation(10, 0), scaling(2, 2));
    near(apply(both, [1, 1]), [12, 2]);
    expect(compose(IDENTITY, both)).toEqual(both);
  });

  it("reflects across a line and flips the determinant", () => {
    const mirror = reflectionAcross([0, 5], [1, 0]);
    near(apply(mirror, [3, 7]), [3, 3]);
    expect(determinant(mirror)).toBeCloseTo(-1);
    near(apply(compose(mirror, mirror), [3, 7]), [3, 7]);
  });

  it("refuses to undo a flattening and to mirror across nothing", () => {
    expect(() => invert(scaling(0, 1))).toThrow(RangeError);
    expect(() => reflectionAcross([0, 0], [0, 0])).toThrow(RangeError);
  });
});

describe("polygon", () => {
  const square = boxRing({ minX: 0, minY: 0, maxX: 10, maxY: 10 });

  it("measures bounds, area and winding", () => {
    expect(boundsOf(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(signedArea(square)).toBe(100);
    expect(areaOf([...square].reverse())).toBe(100);
    expect(() => boundsOf([])).toThrow(RangeError);
  });

  it("tests points, including the edge, and containment", () => {
    expect(pointInRing([5, 5], square)).toBe(true);
    expect(pointInRing([10, 5], square)).toBe(true);
    expect(pointInRing([11, 5], square)).toBe(false);
    expect(ringWithin(turnedRect([5, 5], 4, 4, 0.3), square)).toBe(true);
    expect(ringWithin(turnedRect([9, 5], 4, 4, 0), square)).toBe(false);
  });

  it("grows boxes, finds overlap, rounds and draws circles", () => {
    expect(growBox({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 2).maxX).toBe(3);
    expect(boxesOverlap({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { minX: 1, minY: 1, maxX: 2, maxY: 2 })).toBe(true);
    expect(boxesOverlap({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { minX: 2, minY: 2, maxX: 3, maxY: 3 })).toBe(false);
    expect(round2(1.005 + 0.0001)).toBe(1.01);
    const circle = circleRing([0, 0], 15);
    expect(circle).toHaveLength(64);
    expect(areaOf(circle)).toBeGreaterThan(Math.PI * 225 * 0.997);
  });
});

describe("clip", () => {
  const a = boxRing({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  const b = boxRing({ minX: 5, minY: 5, maxX: 15, maxY: 15 });

  it("subtracts, intersects and merges", () => {
    expect(areaOf(subtractRings([a], [b])[0] ?? [])).toBeCloseTo(75, 1);
    expect(areaOf(intersectRings([a], [b])[0] ?? [])).toBeCloseTo(25, 1);
    expect(areaOf(mergeRings([a, b])[0] ?? [])).toBeCloseTo(175, 1);
    expect(subtractRings([a], [])).toEqual([a]);
  });
});
