import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { WATERMARK_TEXT, watermark, watermarkSvg } from "./watermark";

const plain = async (width = 400, height = 300): Promise<Uint8Array> =>
  new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#3366cc" } }).png().toBuffer());

const pixels = async (png: Uint8Array) => (await sharp(png).raw().toBuffer({ resolveWithObject: true })).data;

describe("watermark", () => {
  it("changes the picture but keeps its size", async () => {
    const clean = await plain();
    const marked = await watermark(clean);
    expect(Buffer.from(marked).equals(Buffer.from(clean))).toBe(false);
    const meta = await sharp(marked).metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]);
  });

  it("is the same bytes for the same picture", async () => {
    const clean = await plain();
    expect(Buffer.from(await watermark(clean)).equals(Buffer.from(await watermark(clean)))).toBe(true);
  });

  it("covers the whole picture, not one corner", async () => {
    const clean = await pixels(await plain());
    const marked = await pixels(await watermark(await plain()));
    const quarters = [0, 1, 2, 3].map((q) => {
      let changed = 0;
      const per = Math.floor(clean.length / 4);
      for (let i = q * per; i < (q + 1) * per; i += 1) if (clean[i] !== marked[i]) changed += 1;
      return changed;
    });
    for (const changed of quarters) expect(changed).toBeGreaterThan(100);
  });

  it("writes the words in the pattern", () => {
    expect(watermarkSvg(400, 300)).toContain(WATERMARK_TEXT);
  });

  it("refuses bytes that are not a picture", async () => {
    await expect(watermark(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
