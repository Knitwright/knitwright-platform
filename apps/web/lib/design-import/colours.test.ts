import { describe, expect, it } from "vitest";
import { deltaE, dominantColours, labFromRgb, rgbFromLab } from "./colours";
import { createMask, createRaster } from "./raster";
import { fillRect, teeGeometry, teePicture } from "./fixtures/synthetic";
import { findOutline, type Outline } from "./outline";

describe("Lab", () => {
  it("round trips colours and puts white at 100", () => {
    expect(labFromRgb([255, 255, 255])[0]).toBeCloseTo(100, 0);
    for (const rgb of [[27, 42, 73], [200, 30, 40], [10, 120, 10]] as const) {
      const back = rgbFromLab(labFromRgb(rgb));
      back.forEach((v, i) => expect(Math.abs(v - rgb[i])).toBeLessThanOrEqual(1));
    }
  });

  it("measures how far apart two colours look", () => {
    expect(deltaE(labFromRgb([0, 0, 0]), labFromRgb([0, 0, 0]))).toBe(0);
    expect(deltaE(labFromRgb([250, 250, 250]), labFromRgb([255, 255, 255]))).toBeLessThan(3);
    expect(deltaE(labFromRgb([255, 0, 0]), labFromRgb([0, 0, 255]))).toBeGreaterThan(50);
  });
});

const outlineOf = (raster: ReturnType<typeof teePicture>): Outline => findOutline(raster).value as Outline;

describe("dominantColours", () => {
  it("finds the one colour of a plain garment", () => {
    const raster = teePicture({ garment: [27, 42, 73] });
    const found = dominantColours([{ raster, mask: outlineOf(raster).mask }]);
    expect(found.value).toHaveLength(1);
    expect(found.value[0].hex).toBe("#1b2a49");
    expect(found.value[0].share).toBeGreaterThan(0.95);
    expect(found.confidence).toBeGreaterThan(0.8);
  });

  it("finds a stripe's second colour and orders them by area", () => {
    const raster = teePicture({ garment: [27, 42, 73] });
    fillRect(raster, 215, 200, 210, 60, [212, 175, 55]);
    const found = dominantColours([{ raster, mask: outlineOf(raster).mask }]);
    expect(found.value.map((c) => c.hex)).toEqual(["#1b2a49", "#d4af37"]);
    expect(found.value[0].share).toBeGreaterThan(found.value[1].share);
  });

  it("merges colours that are nearly the same, as shading would make them", () => {
    const raster = teePicture({ garment: [27, 42, 73] });
    fillRect(raster, 215, 200, 210, 60, [31, 46, 77]);
    expect(dominantColours([{ raster, mask: outlineOf(raster).mask }]).value).toHaveLength(1);
  });

  it("keeps out areas it is told to leave out, such as a mark's box", () => {
    const raster = teePicture({ garment: [27, 42, 73] });
    fillRect(raster, 280, 200, 80, 80, [255, 255, 255]);
    const outline = outlineOf(raster);
    const withMark = dominantColours([{ raster, mask: outline.mask }]);
    const without = dominantColours([{ raster, mask: outline.mask, exclude: [{ x: 270, y: 190, w: 100, h: 100 }] }]);
    expect(withMark.value.some((c) => c.hex === "#ffffff")).toBe(true);
    expect(without.value.some((c) => c.hex === "#ffffff")).toBe(false);
  });

  it("returns at most six, and drops specks", () => {
    const raster = teePicture({ garment: [20, 20, 20] });
    const palette: [number, number, number][] = [[200, 20, 20], [20, 200, 20], [20, 20, 200], [200, 200, 20], [200, 20, 200], [20, 200, 200], [240, 240, 240]];
    palette.forEach((c, i) => fillRect(raster, 230 + (i % 4) * 40, 150 + Math.floor(i / 4) * 70, 38, 60, c));
    fillRect(raster, 250, 400, 2, 2, [255, 128, 0]);
    const found = dominantColours([{ raster, mask: outlineOf(raster).mask }]);
    expect(found.value.length).toBeLessThanOrEqual(6);
    expect(found.value.some((c) => c.hex === "#ff8000")).toBe(false);
  });

  it("says so when there is nothing to read", () => {
    const found = dominantColours([{ raster: createRaster(10, 10), mask: createMask(10, 10) }]);
    expect(found.value).toEqual([]);
    expect(found.confidence).toBe(0);
  });

  it("is a closed set: same input, same answer", () => {
    const raster = teePicture({ garment: [27, 42, 73] });
    const mask = outlineOf(raster).mask;
    expect(dominantColours([{ raster, mask }])).toEqual(dominantColours([{ raster, mask }]));
    expect(teeGeometry().polygon.length).toBeGreaterThan(5);
  });
});
