import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/flat/model";
import { chordsOf, openEdges, polygonArea, resample, triangulateRegion } from "./triangulate";

const square: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

/** A T shape, like a tee with its sleeves out: it has corners that point inwards. */
const tee: Point[] = [
  { x: -300, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 120 },
  { x: 120, y: 120 },
  { x: 120, y: 500 },
  { x: -120, y: 500 },
  { x: -120, y: 120 },
  { x: -300, y: 120 },
];

const triangleArea = (a: Point, b: Point, c: Point): number => ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;

describe("resample", () => {
  it("keeps every corner and leaves no step longer than the spacing", () => {
    const points = resample(square, 30, true);
    for (const corner of square) expect(points).toContainEqual(corner);
    const closed = [...points, points[0] as Point];
    for (let i = 1; i < closed.length; i += 1) {
      const a = closed[i - 1] as Point;
      const b = closed[i] as Point;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(30 + 1e-9);
    }
  });

  it("does not return to the start of an open line", () => {
    const points = resample([{ x: 0, y: 0 }, { x: 100, y: 0 }], 25, false);
    expect(points.at(-1)).toEqual({ x: 100, y: 0 });
    expect(points).toHaveLength(5);
  });
});

describe("triangulateRegion", () => {
  for (const [name, loop] of [["a square", square], ["a T shape", tee]] as const) {
    describe(name, () => {
      const result = triangulateRegion(loop, [], 20);

      it("covers the region exactly", () => {
        const total = result.triangles.reduce(
          (sum, [a, b, c]) => sum + triangleArea(result.points[a] as Point, result.points[b] as Point, result.points[c] as Point),
          0,
        );
        expect(total).toBeCloseTo(Math.abs(polygonArea(loop)), 6);
      });

      it("turns every triangle the same way and makes none flat", () => {
        for (const [a, b, c] of result.triangles) {
          expect(triangleArea(result.points[a] as Point, result.points[b] as Point, result.points[c] as Point)).toBeGreaterThan(1e-6);
        }
      });

      it("has one open border, which runs along the outline", () => {
        const edges = openEdges(result.triangles);
        expect(edges.length).toBeGreaterThan(loop.length);
        const onOutline = (point: Point): boolean =>
          loop.some((a, i) => {
            const b = loop[(i + 1) % loop.length] as Point;
            const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
            const within = Math.min(a.x, b.x) - 1e-6 <= point.x && point.x <= Math.max(a.x, b.x) + 1e-6 && Math.min(a.y, b.y) - 1e-6 <= point.y && point.y <= Math.max(a.y, b.y) + 1e-6;
            return Math.abs(cross) < 1e-6 * Math.hypot(b.x - a.x, b.y - a.y) && within;
          });
        for (const [a, b] of edges) {
          expect(onOutline(result.points[a] as Point)).toBe(true);
          expect(onOutline(result.points[b] as Point)).toBe(true);
        }
      });

      it("has no inside edge that joins two points of the border", () => {
        expect(chordsOf(result.triangles)).toEqual([]);
      });

      it("puts points inside the region, not only on its edge", () => {
        const border = new Set(openEdges(result.triangles).flat());
        expect(result.points.length - border.size).toBeGreaterThan(10);
      });
    });
  }

  it("follows a line drawn inside the region", () => {
    const line: Point[] = [
      { x: 20, y: 50 },
      { x: 80, y: 50 },
    ];
    const result = triangulateRegion(square, [line], 20);
    for (const point of resample(line, 20 / 2, false)) {
      expect(result.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 1e-9)).toBe(true);
    }
  });

  it("gives the same answer every time", () => {
    expect(triangulateRegion(tee, [], 25)).toEqual(triangulateRegion(tee, [], 25));
  });
});
