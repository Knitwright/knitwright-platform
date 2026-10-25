import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analysisSize, ANALYSIS_SIDE, decodeFrame, lumaOf, readSize } from "./frame";

describe("frame", () => {
  it("shrinks big pictures to the analysis side and never enlarges small ones", () => {
    expect(analysisSize({ width: 2048, height: 1024 })).toEqual({ width: ANALYSIS_SIDE, height: 256 });
    expect(analysisSize({ width: 100, height: 50 })).toEqual({ width: 100, height: 50 });
  });

  it("reads the shown size, swapping for a turned picture, and null for junk", async () => {
    const png = await sharp({ create: { width: 30, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await readSize(png)).toEqual({ width: 30, height: 10 });
    const turned = await sharp({ create: { width: 30, height: 10, channels: 3, background: "#fff" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect(await readSize(turned)).toEqual({ width: 10, height: 30 });
    expect(await readSize(new Uint8Array([0, 1, 2]))).toBeNull();
  });

  it("decodes alpha into a mask and composites see-through pixels over white", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 2, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(), left: 0, top: 0 }])
      .png()
      .toBuffer();
    const frame = await decodeFrame(png, { width: 4, height: 4 });
    expect(Array.from(frame.mask.slice(0, 4))).toEqual([1, 1, 0, 0]);
    expect(lumaOf(frame)).toHaveLength(16);
  });
});
