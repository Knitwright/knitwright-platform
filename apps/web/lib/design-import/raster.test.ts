import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { RASTER_UNREADABLE, blankRaster, decodeRaster, encodePng, filledRect, pixelAt, toHex } from "./raster";
import { renderTee } from "./fixtures/synthetic";

describe("raster", () => {
  it("decodes a picture to the analysis copy", async () => {
    const { png } = await renderTee();
    const raster = await decodeRaster(png, 200);
    expect(raster.width).toBe(200);
    expect(pixelAt(raster, 0, 0)).toEqual([242, 242, 242]);
    expect(toHex(pixelAt(raster, 100, 150))).toBe("#c8102e");
  });

  it("flattens transparency on white and does not enlarge", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const raster = await decodeRaster(new Uint8Array(png));
    expect(raster.width).toBe(10);
    expect(pixelAt(raster, 5, 5)).toEqual([255, 255, 255]);
  });

  it("refuses bytes that are not a picture with a plain sentence", async () => {
    await expect(decodeRaster(new Uint8Array([1, 2, 3]))).rejects.toThrow(RASTER_UNREADABLE);
  });

  it("round-trips through a PNG and fills a copy without changing the original", async () => {
    const raster = blankRaster(4, 4, [10, 20, 30]);
    const filled = filledRect(raster, { x0: -2, y0: 1, x1: 2, y1: 9 }, [200, 0, 0]);
    expect(pixelAt(raster, 0, 1)).toEqual([10, 20, 30]);
    expect(pixelAt(filled, 1, 3)).toEqual([200, 0, 0]);
    expect(pixelAt(filled, 3, 3)).toEqual([10, 20, 30]);
    const back = await decodeRaster(await encodePng(filled));
    expect(pixelAt(back, 0, 2)).toEqual([200, 0, 0]);
  });
});
