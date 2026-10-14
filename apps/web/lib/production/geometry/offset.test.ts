import { describe, expect, it } from "vitest";
import type { Point } from "../contract/pieces";
import { JERSEY_EU48 } from "../fixtures";
import { offsetOutline, outlineArea } from "./offset";

const SQUARE: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]];

describe("offsetting an outline", () => {
  it("grows a square by the distance on every side, with mitred corners", () => {
    expect(outlineArea(offsetOutline(SQUARE, 10, "miter"))).toBeCloseTo(120 * 120, 0);
  });

  it("rounds the corners by default, so the area is a little less than mitred", () => {
    const round = outlineArea(offsetOutline(SQUARE, 10));
    expect(round).toBeGreaterThan(100 * 100 + 4 * 100 * 10);
    expect(round).toBeLessThan(120 * 120);
  });

  it("shrinks an outline with a negative distance", () => {
    expect(outlineArea(offsetOutline(SQUARE, -10, "miter"))).toBeCloseTo(80 * 80, 0);
  });

  it("grows a real piece, and offsetting back by the same distance returns near its area", () => {
    const front = JERSEY_EU48.piecesBySize["48"].find((p) => p.id === "front");
    if (!front) throw new Error("fixture has no front");
    const grown = offsetOutline(front.cutOutline, 6, "miter");
    expect(outlineArea(grown)).toBeGreaterThan(outlineArea(front.cutOutline));
    const back = offsetOutline(grown, -6, "miter");
    expect(Math.abs(outlineArea(back) - outlineArea(front.cutOutline)) / outlineArea(front.cutOutline)).toBeLessThan(0.002);
  });

  it("does not change the outline it is given", () => {
    const copy = SQUARE.map((p): Point => [p[0], p[1]]);
    offsetOutline(copy, 5);
    expect(copy).toEqual(SQUARE);
  });

  it("refuses a distance that is not a number and an outline with fewer than three points", () => {
    expect(() => offsetOutline(SQUARE, Number.NaN)).toThrow(RangeError);
    expect(() => offsetOutline([[0, 0], [1, 1]], 1)).toThrow(RangeError);
  });

  it("returns nothing when an outline is shrunk to nothing", () => {
    expect(offsetOutline(SQUARE, -80, "miter")).toEqual([]);
  });
});
