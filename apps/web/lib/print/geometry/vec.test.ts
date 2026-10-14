import { describe, expect, it } from "vitest";
import { boundsOf, centroid, mirrorAcross, pointInPolygon, polygonArea, rotateBy, round2, signedArea, unit } from "./vec";

describe("vec", () => {
  it("rounds to 0.01 mm and never returns negative zero", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
  });
  it("finds bounds, area and centroid of a rectangle", () => {
    const rect: [number, number][] = [[0, 0], [10, 0], [10, 4], [0, 4]];
    expect(boundsOf(rect)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 4 });
    expect(polygonArea(rect)).toBe(40);
    expect(signedArea(rect)).toBe(40);
    expect(signedArea([...rect].reverse())).toBe(-40);
    expect(centroid(rect)).toEqual([5, 2]);
  });
  it("tests points in a polygon", () => {
    const tri: [number, number][] = [[0, 0], [10, 0], [0, 10]];
    expect(pointInPolygon([2, 2], tri)).toBe(true);
    expect(pointInPolygon([8, 8], tri)).toBe(false);
  });
  it("rotates and normalises", () => {
    const r = rotateBy([1, 0], 90);
    expect(r[0]).toBeCloseTo(0, 9);
    expect(r[1]).toBeCloseTo(1, 9);
    expect(unit([0, 5])).toEqual([0, 1]);
    expect(() => unit([0, 0])).toThrow(RangeError);
  });
  it("mirrors across a line", () => {
    expect(mirrorAcross([3, 2], [0, 0], [1, 0])).toEqual([3, -2]);
    expect(mirrorAcross([3, 2], [0, 5], [0, 6])).toEqual([-3, 2]);
  });
});
