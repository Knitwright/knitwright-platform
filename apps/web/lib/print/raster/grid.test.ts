import { describe, expect, it } from "vitest";
import { MAX_FILE_PIXELS, fileDpiFor, pixelGrid, stripsOf } from "./grid";

const box = { minX: 0, minY: 0, maxX: 1039.6, maxY: 549.7 };

describe("pixel grid", () => {
  it("sizes a page at the stated dpi", () => {
    const g = pixelGrid(box, 150);
    expect(g.widthPx).toBe(Math.round((1039.6 / 25.4) * 150));
    expect(g.heightPx).toBe(Math.round((549.7 / 25.4) * 150));
    expect(g.widthPx / g.pxPerMmX).toBeCloseTo(1039.6, 6);
  });
  it("cuts the page into strips that cover every row once and stay within the budget", () => {
    const g = pixelGrid(box, 150);
    const strips = stripsOf(box, g, 1_000_000);
    expect(strips.length).toBeGreaterThan(1);
    expect(strips.reduce((n, s) => n + s.heightPx, 0)).toBe(g.heightPx);
    for (const s of strips) expect(s.widthPx * s.heightPx).toBeLessThanOrEqual(1_000_000 + g.widthPx);
    expect(strips[0].box.maxY).toBeCloseTo(box.maxY, 9);
    expect(strips.at(-1)!.box.minY).toBeCloseTo(box.minY, 6);
    strips.slice(1).forEach((s, i) => expect(s.box.maxY).toBeCloseTo(strips[i].box.minY, 9));
  });
  it("takes one strip when the page is small", () => {
    expect(stripsOf(box, pixelGrid(box, 20))).toHaveLength(1);
  });
  it("lowers the dpi over the pixel cap and says so", () => {
    expect(fileDpiFor(box, 150)).toEqual({ dpi: 150, lowered: false });
    const big = { minX: 0, minY: 0, maxX: 6000, maxY: 4000 };
    const r = fileDpiFor(big, 150);
    expect(r.lowered).toBe(true);
    expect(r.dpi).toBeLessThan(150);
    const g = pixelGrid(big, r.dpi);
    expect(g.widthPx * g.heightPx).toBeLessThanOrEqual(MAX_FILE_PIXELS * 1.02);
  });
});
