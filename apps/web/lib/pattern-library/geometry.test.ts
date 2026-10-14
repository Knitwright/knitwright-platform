import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/production/contract";
import { add, crossesItself, cross, dist, dot, lineMeet, mid, nearestPointOnOutline, nearestVertex, pointAlong, round2, roundPoint, runLength, scale, segmentsMeet, signedArea, slice, sub, unit } from "./geometry";

const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];

describe("vectors", () => {
  it("add, subtract, scale, dot, cross, middle and distance", () => {
    expect(add([1, 2], [3, 4])).toEqual([4, 6]);
    expect(sub([5, 5], [2, 1])).toEqual([3, 4]);
    expect(scale([1, 2], 3)).toEqual([3, 6]);
    expect(dot([1, 2], [3, 4])).toBe(11);
    expect(cross([1, 0], [0, 1])).toBe(1);
    expect(mid([0, 0], [4, 2])).toEqual([2, 1]);
    expect(dist([0, 0], [3, 4])).toBe(5);
  });

  it("makes unit vectors, and a zero vector stays zero", () => {
    expect(unit([0, 5])).toEqual([0, 1]);
    expect(unit([0, 0])).toEqual([0, 0]);
  });
});

describe("rounding", () => {
  it("rounds to 0.01 by the number's exact value and never gives minus zero", () => {
    expect(round2(95.615)).toBe(95.61);
    expect(round2(1.005)).toBe(1);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
    expect(roundPoint([1.234, -5.678])).toEqual([1.23, -5.68]);
  });
});

describe("outlines", () => {
  it("gives the signed area, positive anticlockwise", () => {
    expect(signedArea(square)).toBe(100);
    expect(signedArea([...square].reverse())).toBe(-100);
  });

  it("measures a run and slices a closed outline, wrapping round the end", () => {
    expect(runLength(square)).toBe(30);
    expect(slice(square, 2, 1)).toEqual([[10, 10], [0, 10], [0, 0], [10, 0]]);
    expect(slice(square, 0, 2)).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it("finds the nearest vertex and the nearest point on an outline", () => {
    expect(nearestVertex(square, [9, 1])).toEqual({ index: 1, distance: Math.hypot(1, 1) });
    expect(nearestPointOnOutline(square, [5, -3])).toEqual({ point: [5, 0], distance: 3 });
    expect(nearestPointOnOutline([[0, 0], [0, 0], [4, 0]], [1, 1]).distance).toBe(1);
    expect(nearestPointOnOutline([[2, 2], [2, 2], [2, 2]], [5, 6]).distance).toBe(5);
  });

  it("walks along a run, clamped to its ends and over repeated points", () => {
    const run: Point[] = [[0, 0], [10, 0], [10, 10]];
    expect(pointAlong(run, 5)).toEqual([5, 0]);
    expect(pointAlong(run, 15)).toEqual([10, 5]);
    expect(pointAlong(run, 99)).toEqual([10, 10]);
    expect(pointAlong(run, -4)).toEqual([0, 0]);
    expect(pointAlong([[1, 1], [1, 1], [3, 1]], 1)).toEqual([2, 1]);
    expect(pointAlong([[1, 1]], 3)).toEqual([1, 1]);
  });
});

describe("crossing", () => {
  it("says when two segments cross, touch or miss", () => {
    expect(segmentsMeet([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsMeet([0, 0], [10, 0], [5, 0], [5, 5])).toBe(true);
    expect(segmentsMeet([0, 0], [10, 0], [0, 0], [-5, 0])).toBe(true);
    expect(segmentsMeet([0, 0], [10, 0], [3, 0], [20, 0])).toBe(true);
    expect(segmentsMeet([0, 0], [10, 0], [0, 1], [10, 1])).toBe(false);
    expect(segmentsMeet([0, 0], [10, 0], [12, 0], [20, 0])).toBe(false);
  });

  it("finds a bow tie and passes a plain outline", () => {
    expect(crossesItself(square)).toBe(false);
    expect(crossesItself([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(true);
  });

  it("meets two lines, or none when they are parallel", () => {
    expect(lineMeet([0, 0], [1, 0], [5, -5], [0, 1])).toEqual([5, 0]);
    expect(lineMeet([0, 0], [1, 0], [0, 1], [1, 0])).toBeNull();
  });
});
