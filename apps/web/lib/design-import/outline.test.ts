import { describe, expect, it } from "vitest";
import { findOutline, pointInPolygon, polygonArea, simplify } from "./outline";
import { blankRaster, decodeRaster, filledRect } from "./raster";
import { renderTee, TEE_OUTLINE } from "./fixtures/synthetic";

describe("findOutline", () => {
  it("finds a garment against a plain background, holes included", async () => {
    const { png } = await renderTee({ extra: '<rect x="170" y="150" width="60" height="40" fill="#f2f2f2"/>' });
    const raster = await decodeRaster(png);
    const result = findOutline(raster, { x0: 0, y0: 0, x1: raster.width, y1: raster.height });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The hole (same colour as the background) is filled by the outline.
    expect(result.mask[170 * raster.width + 200]).toBe(1);
    const truth = polygonArea(TEE_OUTLINE) * (raster.width / 400) ** 2;
    expect(Math.abs(polygonArea(result.polygon) - truth) / truth).toBeLessThan(0.04);
    expect(result.polygon.length).toBeLessThan(80);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("says plainly when there is no garment to find", () => {
    const empty = blankRaster(100, 100, [240, 240, 240]);
    const result = findOutline(empty, { x0: 0, y0: 0, x1: 100, y1: 100 });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toMatch(/outline/i);
  });

  it("fails when the garment fills the whole region (no background to separate)", () => {
    const full = filledRect(blankRaster(50, 50, [240, 240, 240]), { x0: 1, y0: 1, x1: 49, y1: 49 }, [200, 0, 0]);
    expect(findOutline(full, { x0: 0, y0: 0, x1: 50, y1: 50 }).ok).toBe(false);
  });

  it("keeps the largest region and reads only inside the given region", async () => {
    let raster = blankRaster(200, 100, [250, 250, 250]);
    raster = filledRect(raster, { x0: 10, y0: 10, x1: 80, y1: 90 }, [0, 0, 200]);
    raster = filledRect(raster, { x0: 90, y0: 40, x1: 96, y1: 46 }, [0, 0, 200]);
    const result = findOutline(raster, { x0: 0, y0: 0, x1: 100, y1: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bbox).toEqual({ minX: 10, minY: 10, maxX: 79, maxY: 89 });
  });
});

describe("polygon helpers", () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  it("measures area and containment", () => {
    expect(polygonArea(square)).toBe(100);
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
  it("simplifies a straight run away", () => {
    const line = [{ x: 0, y: 0 }, { x: 5, y: 0.1 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(simplify(line, 1)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(simplify(line.slice(0, 2), 1)).toHaveLength(2);
  });
});
