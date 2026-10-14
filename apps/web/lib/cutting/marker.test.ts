import { describe, expect, it } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { ESTIMATE_LABEL, stripPackingEstimator, markerItemsFor, type MarkerItem } from "./marker";

const rect = (w: number, h: number): [number, number][] => [[0, 0], [w, 0], [w, h], [0, h]];
const item = (id: string, w: number, h: number, copies = 1, grainAngleDeg: number | null = 0): MarkerItem => ({ id, outline: rect(w, h), grainAngleDeg, copies });

describe("stripPackingEstimator", () => {
  it("carries the same label as the default efficiency, since it is not a marker", () => {
    expect(stripPackingEstimator.label).toBe(ESTIMATE_LABEL);
    expect(ESTIMATE_LABEL).toMatch(/not from a marker/i);
  });

  it("lays two pieces side by side when the fabric is wide enough", () => {
    const r = stripPackingEstimator.estimate({ items: [item("a", 500, 600), item("b", 500, 600)], widthMm: 1600 });
    expect(r).toMatchObject({ fits: true, lengthMm: 500, unplaced: [] });
  });

  it("starts a new strip when the width runs out", () => {
    const r = stripPackingEstimator.estimate({ items: [item("a", 500, 900), item("b", 400, 900)], widthMm: 1000 });
    expect(r.lengthMm).toBe(900);
  });

  it("counts copies", () => {
    // Each copy is 600 across, so only one fits a 1000 wide strip: three strips of 300.
    const r = stripPackingEstimator.estimate({ items: [item("a", 300, 600, 3)], widthMm: 1000 });
    expect(r.lengthMm).toBe(900);
  });

  it("turns a piece so its grain line runs along the fabric", () => {
    // A tall piece with its grain across: turned a quarter, it is 600 along and 300 across.
    const r = stripPackingEstimator.estimate({ items: [item("a", 300, 600, 1, 90)], widthMm: 1000 });
    expect(r.lengthMm).toBeCloseTo(600, 5);
  });

  it("reports a piece wider than the fabric instead of squeezing it", () => {
    const r = stripPackingEstimator.estimate({ items: [item("wide", 300, 1200)], widthMm: 1000 });
    expect(r.fits).toBe(false);
    expect(r.unplaced).toEqual(["wide"]);
    expect(r.sentence).toMatch(/wider than the fabric/i);
  });

  it("is never better than the pieces' own area", () => {
    const r = stripPackingEstimator.estimate({ items: [item("a", 500, 600), item("b", 300, 700)], widthMm: 1600 });
    expect(r.efficiency).toBeGreaterThan(0);
    expect(r.efficiency).toBeLessThanOrEqual(1);
  });

  it("gives the same answer whatever order the pieces come in", () => {
    const a = [item("a", 500, 600), item("b", 300, 700), item("c", 200, 200, 2)];
    const first = stripPackingEstimator.estimate({ items: a, widthMm: 900 });
    const second = stripPackingEstimator.estimate({ items: [...a].reverse(), widthMm: 900 });
    expect(second).toEqual(first);
  });

  it("refuses a fabric of no width", () => {
    expect(() => stripPackingEstimator.estimate({ items: [item("a", 1, 1)], widthMm: 0 })).toThrow();
  });

  it("has nothing to lay for no pieces", () => {
    expect(stripPackingEstimator.estimate({ items: [], widthMm: 1000 })).toMatchObject({ lengthMm: 0, fits: true });
  });
});

describe("markerItemsFor", () => {
  it("opens pieces cut on a fold and keeps the grain angle", () => {
    const items = markerItemsFor(JERSEY_EU48.piecesBySize["48"]!);
    const front = items.find((i) => i.id === "front")!;
    expect(front.copies).toBe(1);
    expect(front.grainAngleDeg).toBe(0);
    const ys = front.outline.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(500);
  });

  it("estimates the jersey on 160 cm fabric with every piece placed", () => {
    const r = stripPackingEstimator.estimate({ items: markerItemsFor(JERSEY_EU48.piecesBySize["48"]!), widthMm: 1600 });
    expect(r.fits).toBe(true);
    expect(r.lengthMm).toBeGreaterThan(700);
    expect(r.lengthMm).toBeLessThan(2500);
  });
});
