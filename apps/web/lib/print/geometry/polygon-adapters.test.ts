import { describe, expect, it } from "vitest";
import { polygonArea as outlineArea } from "@/lib/design-import/outline";
import { polygonArea as triangulateArea } from "@/lib/garment3d/triangulate";
import { signedArea as libraryArea } from "@/lib/pattern-library/geometry";
import { polygonArea as techpackArea } from "@/lib/techpack/production/geometry";
import { signedArea, signedAreaXY } from "./polygon";

type Tuple = [number, number];

const ccw: Tuple[] = [[0, 0], [10, 0], [10, 5], [0, 5]];
const cw: Tuple[] = [...ccw].reverse();
const triangle: Tuple[] = [[1.5, 2.25], [7.125, -3], [4, 9.5]];
const concave: Tuple[] = [[0, 0], [8, 0], [8, 8], [4, 3], [0, 8]];
const SHAPES: readonly Tuple[][] = [ccw, cw, triangle, concave, [[0, 0]], []];

const asXY = (ring: readonly Tuple[]) => ring.map(([x, y]) => ({ x, y }));

/** The implementations as they were before they were consolidated. */
const oldShoelaceXY = (points: readonly { x: number; y: number }[]): number =>
  points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length] as { x: number; y: number };
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;

const oldHalvedTerms = (loop: readonly { x: number; y: number }[]): number =>
  loop.reduce((sum, a, i) => {
    const b = loop[(i + 1) % loop.length] as { x: number; y: number };
    return sum + (a.x * b.y - b.x * a.y) / 2;
  }, 0);

const oldTupleSigned = (ring: readonly Tuple[]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] as Tuple;
    const [x2, y2] = ring[(i + 1) % ring.length] as Tuple;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
};

describe("polygon area adapters", () => {
  it("keeps the sign convention: positive counter-clockwise", () => {
    expect(signedArea(ccw)).toBe(50);
    expect(signedArea(cw)).toBe(-50);
  });

  it.each(SHAPES.map((shape, i) => [i, shape] as const))("matches the old implementations on shape %i", (_, ring) => {
    const xy = asXY(ring);
    expect(signedArea(ring)).toBe(oldTupleSigned(ring));
    expect(libraryArea(ring)).toBe(oldTupleSigned(ring));
    expect(signedAreaXY(xy)).toBe(oldShoelaceXY(xy));
    expect(triangulateArea(xy)).toBe(oldHalvedTerms(xy));
    expect(outlineArea(xy)).toBe(Math.abs(oldShoelaceXY(xy)));
    expect(techpackArea([...ring])).toBe(Math.abs(oldTupleSigned(ring)));
  });
});
