import { describe, expect, it } from "vitest";
import { boxBlur, dilate, erode, gradientMagnitude, median, pearson } from "./planes";

const square = (w: number, h: number, x0: number, y0: number, x1: number, y1: number): Uint8Array => {
  const m = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1;
  return m;
};
const count = (m: Uint8Array): number => m.reduce((s, v) => s + v, 0);

describe("planes", () => {
  it("blurs a spike into its neighbours and keeps the total", () => {
    const src = new Float32Array(25);
    src[12] = 25;
    const out = boxBlur(src, 5, 5, 1);
    expect(out[12]).toBeCloseTo(25 / 9, 5);
    expect(out[6]).toBeCloseTo(25 / 9, 5);
    expect(src[12]).toBe(25);
  });

  it("returns a copy for radius 0", () => {
    const src = Float32Array.from([1, 2, 3, 4]);
    const out = boxBlur(src, 2, 2, 0);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });

  it("erodes and dilates a square by the radius", () => {
    const m = square(12, 12, 3, 3, 9, 9);
    expect(count(erode(m, 12, 12, 1))).toBe(16);
    expect(count(dilate(m, 12, 12, 1))).toBe(64);
    expect(count(m)).toBe(36);
  });

  it("treats outside the picture as unset when eroding", () => {
    expect(count(erode(square(4, 4, 0, 0, 4, 4), 4, 4, 1))).toBe(4);
  });

  it("finds an edge with the gradient", () => {
    const src = new Float32Array(25);
    for (let y = 0; y < 5; y++) for (let x = 2; x < 5; x++) src[y * 5 + x] = 100;
    const g = gradientMagnitude(src, 5, 5);
    expect(g[2 * 5 + 2]).toBeGreaterThan(100);
    expect(g[2 * 5 + 0]).toBe(0);
  });

  it("takes the median of odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median(Float32Array.from([4, 1, 3, 2]))).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it("correlates lists", () => {
    expect(pearson([1, 2, 3], [2, 4, 6]).r).toBeCloseTo(1, 6);
    expect(pearson([1, 2, 3], [3, 2, 1]).r).toBeCloseTo(-1, 6);
    expect(pearson([5, 5, 5], [1, 2, 3])).toMatchObject({ r: 0, spreadA: 0 });
    expect(pearson([], [])).toEqual({ r: 0, spreadA: 0, spreadB: 0 });
  });
});
