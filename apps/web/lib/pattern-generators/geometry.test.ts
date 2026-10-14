import { describe, expect, it } from "vitest";
import { boxOf, boxesOverlap, clipPolygon, directionOf, intersectBoxes, rectPolygon, regularPolygon, rotatePoint, rounded, scaleAbout } from "./geometry";

const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

describe("geometry", () => {
  it("cuts a polygon to a box", () => {
    const cut = clipPolygon(rectPolygon({ minX: -5, minY: 2, maxX: 5, maxY: 4 }), box);
    expect(boxOf(cut ?? [])).toEqual({ minX: 0, minY: 2, maxX: 5, maxY: 4 });
    expect(clipPolygon(rectPolygon({ minX: 20, minY: 0, maxX: 30, maxY: 5 }), box)).toBeNull();
    expect(clipPolygon([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], { minX: 5, minY: 5, maxX: 6, maxY: 6 })).toBeNull();
  });

  it("rotates and scales", () => {
    const turned = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect([Math.round(turned.x), Math.round(turned.y)]).toEqual([0, 1]);
    expect(scaleAbout([{ x: 2, y: 2 }], { x: 0, y: 0 }, 0.5)).toEqual([{ x: 1, y: 1 }]);
    expect(directionOf(0)).toEqual({ x: 1, y: 0 });
    expect(regularPolygon({ x: 0, y: 0 }, 1, 6, 0)).toHaveLength(6);
  });

  it("finds overlaps and intersections", () => {
    expect(boxesOverlap(box, { minX: 5, minY: 5, maxX: 15, maxY: 15 })).toBe(true);
    expect(boxesOverlap(box, { minX: 10, minY: 0, maxX: 15, maxY: 5 })).toBe(false);
    expect(intersectBoxes(box, { minX: 5, minY: 5, maxX: 15, maxY: 15 })).toEqual({ minX: 5, minY: 5, maxX: 10, maxY: 10 });
    expect(intersectBoxes(box, { minX: 10, minY: 0, maxX: 15, maxY: 5 })).toBeNull();
  });

  it("rounds to 0.01 mm", () => {
    expect(rounded([{ x: 1.23456, y: -0.001 }])).toEqual([{ x: 1.23, y: 0 }]);
  });
});
