import { describe, expect, it } from "vitest";
import {
  applyTransform,
  fitTransform,
  polygonArea,
  rmsError,
  simplifyClosed,
  solveLinear,
  type Pair,
} from "./geometry";

describe("solveLinear", () => {
  it("solves a small system and refuses a singular one", () => {
    expect(solveLinear([[2, 1], [1, 3]], [5, 10])?.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 3]);
    expect(solveLinear([[1, 2], [2, 4]], [1, 2])).toBeNull();
  });
});

const pairsOf = (map: (p: { x: number; y: number }) => { x: number; y: number }, points: { x: number; y: number }[]): Pair[] =>
  points.map((from) => ({ from, to: map(from) }));

describe("fitTransform", () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }, { x: 50, y: 100 }];

  it("recovers an affine map from three or more pairs", () => {
    const map = (p: { x: number; y: number }) => ({ x: 2 * p.x + 0.5 * p.y + 10, y: -0.25 * p.x + 3 * p.y - 4 });
    const fit = fitTransform(pairsOf(map, square), "affine");
    expect(fit).not.toBeNull();
    const out = applyTransform(fit!, { x: 30, y: 70 });
    expect(out.x).toBeCloseTo(map({ x: 30, y: 70 }).x, 6);
    expect(out.y).toBeCloseTo(map({ x: 30, y: 70 }).y, 6);
    expect(rmsError(pairsOf(map, square), fit!)).toBeLessThan(1e-6);
  });

  it("recovers a perspective map from four pairs", () => {
    const map = (p: { x: number; y: number }) => {
      const w = 1 + 0.001 * p.x + 0.0005 * p.y;
      return { x: (1.2 * p.x + 5) / w, y: (0.9 * p.y + 0.1 * p.x) / w };
    };
    const fit = fitTransform(pairsOf(map, square), "homography");
    const out = applyTransform(fit!, { x: 80, y: 150 });
    expect(out.x).toBeCloseTo(map({ x: 80, y: 150 }).x, 4);
    expect(out.y).toBeCloseTo(map({ x: 80, y: 150 }).y, 4);
  });

  it("gives nothing when there are too few or collinear points", () => {
    expect(fitTransform(pairsOf((p) => p, square.slice(0, 2)), "affine")).toBeNull();
    expect(fitTransform(pairsOf((p) => p, square.slice(0, 3)), "homography")).toBeNull();
    const line = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    expect(fitTransform(pairsOf((p) => p, line), "affine")).toBeNull();
  });

  it("sends a point at infinity of a homography to itself rather than dividing by zero", () => {
    const fit = { kind: "homography" as const, m: [1, 0, 0, 0, 1, 0, 1, 0, 0] };
    expect(applyTransform(fit, { x: 0, y: 5 })).toEqual({ x: 0, y: 5 });
  });
});

describe("polygons", () => {
  it("measures area", () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }])).toBe(50);
  });

  it("simplifies a closed outline and keeps its corners", () => {
    const dense: { x: number; y: number }[] = [];
    for (let x = 0; x < 20; x += 1) dense.push({ x, y: 0 });
    for (let y = 0; y < 10; y += 1) dense.push({ x: 20, y });
    for (let x = 20; x > 0; x -= 1) dense.push({ x, y: 10 });
    for (let y = 10; y > 0; y -= 1) dense.push({ x: 0, y });
    const simple = simplifyClosed(dense, 0.5);
    expect(simple.length).toBeLessThanOrEqual(6);
    expect(simple.length).toBeGreaterThanOrEqual(4);
  });

  it("leaves a tiny outline alone", () => {
    const tri = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }];
    expect(simplifyClosed(tri, 1)).toEqual(tri);
  });
});
