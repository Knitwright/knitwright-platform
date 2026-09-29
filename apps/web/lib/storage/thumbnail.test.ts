import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { IMAGE_LIMITS } from "./image";
import { DRAWING_EDGE, MAX_INPUT_PIXELS, shrinkForDrawing } from "./thumbnail";

describe("shrinkForDrawing", () => {
  it("makes a large picture small enough to sit inside a page, keeping its shape and type", async () => {
    const big = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#cc3300" } }).png().toBuffer();
    const small = (await shrinkForDrawing({ bytes: new Uint8Array(big), contentType: "image/png" })) as NonNullable<Awaited<ReturnType<typeof shrinkForDrawing>>>;
    const meta = await sharp(small.bytes).metadata();
    expect(small.contentType).toBe("image/png");
    expect(meta.width).toBe(DRAWING_EDGE);
    expect(meta.height).toBe(DRAWING_EDGE / 2);
    expect(small.bytes.byteLength).toBeLessThan(big.byteLength);
  });

  it("does not make a small picture larger", async () => {
    const tiny = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#00cc33" } }).jpeg().toBuffer();
    const result = (await shrinkForDrawing({ bytes: new Uint8Array(tiny), contentType: "image/jpeg" })) as NonNullable<Awaited<ReturnType<typeof shrinkForDrawing>>>;
    expect((await sharp(result.bytes).metadata()).width).toBe(20);
    expect(result.contentType).toBe("image/jpeg");
  });

  it("gives nothing back for bytes that are not a picture", async () => {
    expect(await shrinkForDrawing({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" })).toBeNull();
  });

  it("keeps the same pixel limit as the upload check", () => {
    expect(MAX_INPUT_PIXELS).toBe(IMAGE_LIMITS.maxPixels);
  });

  it("refuses a picture with more pixels than the limit, without decoding it", async () => {
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#00cc33" } }).png().toBuffer();
    const stored = { bytes: new Uint8Array(png), contentType: "image/png" };
    expect(await shrinkForDrawing(stored, 1000)).toBeNull();
    expect(await shrinkForDrawing(stored, 1600)).not.toBeNull();
  });

  it("refuses a real picture that is over the default limit", async () => {
    const huge = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: "#ffffff" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(await shrinkForDrawing({ bytes: new Uint8Array(huge), contentType: "image/png" })).toBeNull();
  });
});
