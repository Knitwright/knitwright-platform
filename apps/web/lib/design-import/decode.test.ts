import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ANALYSIS_MAX_SIDE } from "./raster";
import { decodeForAnalysis } from "./decode";

const png = (width: number, height: number, rgba: [number, number, number, number] = [200, 10, 10, 255]) =>
  sharp({ create: { width, height, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } }).png().toBuffer();

describe("decodeForAnalysis", () => {
  it("decodes a small picture to pixels as they are", async () => {
    const result = await decodeForAnalysis(new Uint8Array(await png(40, 30)));
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.raster.width).toBe(40);
    expect(result.raster.height).toBe(30);
    expect([...result.raster.data.slice(0, 4)]).toEqual([200, 10, 10, 255]);
  });

  it("shrinks a large picture so the longest side is the analysis size", async () => {
    const result = await decodeForAnalysis(new Uint8Array(await png(2400, 1200)));
    if (!result.ok) throw new Error("expected a raster");
    expect(Math.max(result.raster.width, result.raster.height)).toBe(ANALYSIS_MAX_SIDE);
    expect(result.raster.height).toBe(ANALYSIS_MAX_SIDE / 2);
  });

  it("keeps transparency", async () => {
    const result = await decodeForAnalysis(new Uint8Array(await png(10, 10, [0, 0, 0, 0])));
    if (!result.ok) throw new Error("expected a raster");
    expect(result.raster.data[3]).toBe(0);
  });

  it("refuses bytes that are not a picture", async () => {
    expect(await decodeForAnalysis(new Uint8Array([1, 2, 3, 4]))).toEqual({ ok: false });
  });

  it("refuses a picture over the pixel cap before decoding it", async () => {
    const big = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(await decodeForAnalysis(new Uint8Array(big))).toEqual({ ok: false });
  });
});
