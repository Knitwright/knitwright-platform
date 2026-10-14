import { describe, expect, it } from "vitest";
import { boundsOf, openedOutline, rotateAll, grainAngleDeg } from "./geometry";

const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

describe("boundsOf", () => {
  it("gives the box round the points", () => {
    expect(boundsOf([[1, 2], [5, -3], [4, 9]])).toEqual({ minX: 1, maxX: 5, minY: -3, maxY: 9, width: 4, height: 12 });
  });
  it("refuses no points", () => {
    expect(() => boundsOf([])).toThrow();
  });
});

describe("openedOutline", () => {
  it("returns the outline itself when the piece is not cut on a fold", () => {
    expect(openedOutline(square, null)).toEqual(square);
  });
  it("mirrors a half piece about its fold line so the whole piece comes back", () => {
    const opened = openedOutline(square, { from: [0, 0], to: [100, 0] });
    const box = boundsOf(opened);
    expect(box.minY).toBe(-100);
    expect(box.maxY).toBe(100);
    expect(box.width).toBe(100);
  });
  it("keeps the points in order so the outline stays one loop", () => {
    const opened = openedOutline(square, { from: [0, 0], to: [100, 0] });
    expect(opened).toHaveLength(8);
  });
  it("refuses a fold line of no length", () => {
    expect(() => openedOutline(square, { from: [1, 1], to: [1, 1] })).toThrow();
  });
});

describe("grainAngleDeg", () => {
  it("is 0 for a line along x and 90 for a line along y", () => {
    expect(grainAngleDeg({ from: [0, 0], to: [10, 0] })).toBeCloseTo(0);
    expect(grainAngleDeg({ from: [0, 0], to: [0, 10] })).toBeCloseTo(90);
  });
  it("does not care which way the line is drawn", () => {
    expect(grainAngleDeg({ from: [10, 0], to: [0, 0] })).toBeCloseTo(0);
  });
});

describe("rotateAll", () => {
  it("turns points about the origin", () => {
    const [p] = rotateAll([[10, 0]], Math.PI / 2);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBeCloseTo(10);
  });
});
