import { describe, expect, it } from "vitest";
import { polygonArea } from "./geometry";
import { findOutline, separateViews, foregroundMask, traceContour, fillHoles, largestRegion } from "./outline";
import { createMask, createRaster } from "./raster";
import { fillRect, teeGeometry, teePicture } from "./fixtures/synthetic";

const NAVY = [27, 42, 73] as const;

describe("foregroundMask", () => {
  it("tells a garment from a plain background by the corners", () => {
    const { mask, confidence } = foregroundMask(teePicture({ garment: NAVY }));
    expect(confidence).toBeGreaterThan(0.9);
    const set = mask.data.reduce((n, v) => n + v, 0);
    expect(set).toBeGreaterThan(50_000);
    expect(mask.data[0]).toBe(0);
  });

  it("treats a transparent background as background", () => {
    const raster = createRaster(40, 40, [0, 0, 0, 0]);
    fillRect(raster, 10, 10, 20, 20, [200, 0, 0]);
    const { mask, confidence } = foregroundMask(raster);
    expect(mask.data.reduce((n, v) => n + v, 0)).toBe(400);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it("has little confidence when the corners disagree", () => {
    const raster = createRaster(40, 40, [255, 255, 255, 255]);
    fillRect(raster, 0, 0, 20, 20, [0, 0, 0]);
    fillRect(raster, 20, 20, 20, 20, [255, 0, 0]);
    expect(foregroundMask(raster).confidence).toBeLessThanOrEqual(0.5);
  });
});

describe("region and holes", () => {
  it("keeps the largest region and fills holes inside it", () => {
    const mask = createMask(20, 20);
    for (let y = 2; y < 14; y += 1) for (let x = 2; x < 14; x += 1) mask.data[y * 20 + x] = 1;
    mask.data[6 * 20 + 6] = 0; // a hole, like a white stripe
    mask.data[18 * 20 + 18] = 1; // a speck
    const kept = largestRegion(mask);
    expect(kept.area).toBe(143);
    const filled = fillHoles(kept.mask);
    expect(filled.data[6 * 20 + 6]).toBe(1);
    expect(filled.data[18 * 20 + 18]).toBe(0);
  });
});

describe("traceContour", () => {
  it("walks round a rectangle once", () => {
    const mask = createMask(12, 12);
    for (let y = 3; y < 8; y += 1) for (let x = 2; x < 9; x += 1) mask.data[y * 12 + x] = 1;
    const contour = traceContour(mask);
    expect(contour[0]).toEqual({ x: 2, y: 3 });
    expect(contour).toHaveLength(2 * (7 + 5) - 4);
  });

  it("returns a single point for a single pixel, and nothing for an empty mask", () => {
    const one = createMask(5, 5);
    one.data[12] = 1;
    expect(traceContour(one)).toEqual([{ x: 2, y: 2 }]);
    expect(traceContour(createMask(5, 5))).toEqual([]);
  });
});

describe("findOutline", () => {
  it("finds the outline of a flat tee near the true one", () => {
    const result = findOutline(teePicture({ garment: NAVY }));
    expect(result.confidence).toBeGreaterThan(0.8);
    const outline = result.value;
    expect(outline).not.toBeNull();
    const truth = polygonArea(teeGeometry().polygon);
    expect(Math.abs(polygonArea(outline!.polygon) - truth) / truth).toBeLessThan(0.03);
    expect(outline!.polygon.length).toBeLessThan(60);
  });

  it("says so when there is no garment to find", () => {
    const result = findOutline(createRaster(100, 100));
    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.note).toMatch(/told apart/i);
  });

  it("says so when the garment is the same colour as the background", () => {
    const result = findOutline(teePicture({ garment: [250, 250, 250] }));
    expect(result.value).toBeNull();
  });

  it("is less sure when the picture holds several things", () => {
    const raster = teePicture({ garment: NAVY });
    fillRect(raster, 5, 450, 60, 60, [10, 120, 10]);
    const result = findOutline(raster);
    expect(result.value).not.toBeNull();
    expect(result.confidence).toBeLessThan(1);
  });
});

describe("separateViews", () => {
  it("finds a front and a back side by side and orders them left to right", () => {
    const wide = createRaster(1300, 520);
    const front = teePicture({ garment: NAVY });
    const back = teePicture({ garment: NAVY });
    for (let y = 0; y < 520; y += 1) {
      wide.data.set(front.data.subarray(y * 640 * 4, (y + 1) * 640 * 4), y * 1300 * 4);
      wide.data.set(back.data.subarray(y * 640 * 4, (y + 1) * 640 * 4), (y * 1300 + 660) * 4);
    }
    const views = separateViews(wide);
    expect(views.boxes).toHaveLength(2);
    expect(views.boxes[0].x).toBeLessThan(views.boxes[1].x);
  });

  it("finds one view in one picture and none in an empty one", () => {
    expect(separateViews(teePicture({ garment: NAVY })).boxes).toHaveLength(1);
    expect(separateViews(createRaster(50, 50)).boxes).toHaveLength(0);
  });
});
