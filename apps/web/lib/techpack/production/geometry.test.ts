import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { centroid, cutArea, pieceArea, polygonArea } from "./geometry";

const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];

describe("piece geometry", () => {
  it("measures the area of a polygon whichever way it is drawn", () => {
    expect(polygonArea(square)).toBe(100);
    expect(polygonArea([...square].reverse())).toBe(100);
  });

  it("doubles a piece drawn as one half on the fold, and counts every piece cut", () => {
    const base = JERSEY_EU48.piecesBySize["48"]![0]!;
    const half = { ...base, cutOutline: square, onFold: true, quantity: 1 };
    expect(pieceArea(half)).toBe(200);
    expect(cutArea({ ...half, onFold: false, quantity: 2, mirroredPair: true })).toBe(200);
  });

  it("finds the middle of a polygon", () => {
    expect(centroid(square)).toEqual([5, 5]);
    expect(centroid([])).toEqual([0, 0]);
  });
});
