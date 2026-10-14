import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { claimedPng, cmykTiff, logoOnWhite, solid, withDpi } from "./fixtures/images";
import { ARTWORK_LIMITS } from "./limits";
import { fitPrintCopy, ingestRaster, NOT_READABLE, TOO_LARGE_PICTURE, TOO_MANY_BYTES } from "./raster";

describe("ingestRaster", () => {
  it("refuses a 100 000 x 100 000 pixel PNG from its header, before decoding it", async () => {
    const huge = claimedPng(100_000, 100_000);
    await expect(ingestRaster(huge, "png")).rejects.toMatchObject({ code: "too_large", message: TOO_LARGE_PICTURE });
  });

  it("refuses a picture longer than the longest side allowed, even under the pixel count", async () => {
    await expect(ingestRaster(claimedPng(12_001, 100), "png")).rejects.toMatchObject({ code: "too_large" });
  });

  it("refuses a file over the byte limit and a file that is not a picture, with a sentence each", async () => {
    await expect(ingestRaster(new Uint8Array(ARTWORK_LIMITS.maxBytes + 1), "png")).rejects.toMatchObject({ message: TOO_MANY_BYTES });
    await expect(ingestRaster(new TextEncoder().encode("not a picture"), "png")).rejects.toMatchObject({ code: "invalid_input", message: NOT_READABLE });
  });

  it("refuses a picture whose header is fine but whose data is broken", async () => {
    const good = await solid(40, 40, "#336699");
    const broken = good.subarray(0, Math.floor(good.length * 0.6));
    await expect(ingestRaster(broken, "png")).rejects.toBeInstanceOf(AppError);
  });

  it("turns a 600 dpi CMYK TIFF into an sRGB print copy and a screen copy, and names the profile", async () => {
    const result = await ingestRaster(await cmykTiff(), "tiff");
    expect(result.colourSpace).toBe("cmyk");
    expect(result.profileName).toBe("Chemical proof");
    expect(result.dpiMeta).toBe(600);
    const print = await sharp(result.print).metadata();
    expect(print.format).toBe("tiff");
    expect(print.space).toBe("srgb");
    expect(print.depth).toBe("uchar");
    expect(print.density).toBe(600);
    expect(result.screenType).toBe("image/png");
    expect((await sharp(result.screen).metadata()).format).toBe("png");
  });

  it("says so when a picture has no colour profile", async () => {
    const result = await ingestRaster(await solid(40, 30, "#336699"), "png");
    expect(result.profileName).toBeNull();
    expect(result.colourSpace).toBe("unknown");
    expect(result.warnings).toContain("No colour profile was in this file, so its colours were treated as sRGB.");
  });

  it("warns that a CMYK picture with no profile was converted on average", async () => {
    const bare = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#c81e28" } }).toColourspace("cmyk").tiff().toBuffer();
    const result = await ingestRaster(bare, "tiff");
    expect(result.colourSpace).toBe("cmyk");
    expect(result.warnings.join(" ")).toMatch(/CMYK picture had no colour profile/);
  });

  it("reduces 16 bits to 8 and says so", async () => {
    const wide = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#808080" } }).toColourspace("rgb16").png().toBuffer();
    const result = await ingestRaster(wide, "png");
    expect((await sharp(result.print).metadata()).depth).toBe("uchar");
    expect(result.warnings.join(" ")).toMatch(/more than 8 bits/);
  });

  it("keeps what the file says about its resolution and ignores a nonsense value", async () => {
    expect((await ingestRaster(await withDpi(100, 100, 300), "png")).dpiMeta).toBe(300);
    const tiny = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    expect((await ingestRaster(tiny, "png")).dpiMeta).toBeNull();
  });

  it("keeps the see-through parts and stores a JPEG screen copy for a photograph", async () => {
    const clear = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
    expect(await ingestRaster(clear, "png")).toMatchObject({ hasAlpha: true, screenType: "image/png" });
    const photo = await ingestRaster(await solid(60, 60, "#335577", "jpeg"), "jpeg");
    expect(photo).toMatchObject({ hasAlpha: false, screenType: "image/jpeg", screenExtension: "jpg" });
  });

  it("gives a screen copy no larger than the screen limit and keeps the print copy whole", async () => {
    const result = await ingestRaster(await solid(3000, 1500, "#445566"), "png");
    const screen = await sharp(result.screen).metadata();
    expect(Math.max(screen.width ?? 0, screen.height ?? 0)).toBe(ARTWORK_LIMITS.screenEdge);
    expect([result.widthPx, result.heightPx]).toEqual([3000, 1500]);
  });

  it("turns a picture upright as its orientation note says and does not keep the note", async () => {
    const tilted = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#aa3333" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await ingestRaster(tilted, "jpeg");
    expect([result.widthPx, result.heightPx]).toEqual([20, 40]);
    expect((await sharp(result.print).metadata()).orientation ?? 1).toBe(1);
  });

  it("detects a logo on a white box and offers to remove it", async () => {
    const result = await ingestRaster(await logoOnWhite(), "png");
    expect(result.whiteBackground).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/white box/);
    expect((await ingestRaster(await solid(30, 30, "#cc0000"), "png")).whiteBackground).toBe(false);
  });

  it("uses only the first page of a multi-page TIFF and says so", async () => {
    const page = (colour: string) => sharp({ create: { width: 20, height: 20, channels: 3, background: colour } }).raw().toBuffer();
    const joined = await sharp(Buffer.concat([await page("#ff0000"), await page("#0000ff")]), { raw: { width: 20, height: 40, channels: 3, pageHeight: 20 } })
      .tiff()
      .toBuffer();
    const result = await ingestRaster(joined, "tiff");
    expect([result.widthPx, result.heightPx]).toEqual([20, 20]);
    expect(result.warnings.join(" ")).toMatch(/first/);
  });

  it("reduces a print copy that would not fit in storage, and says by how much", async () => {
    const noisy = Buffer.alloc(400 * 400 * 3);
    for (let i = 0; i < noisy.length; i += 1) noisy[i] = (i * 2654435761) >>> 24;
    const tiff = await sharp(noisy, { raw: { width: 400, height: 400, channels: 3 } }).tiff({ compression: "deflate" }).toBuffer();
    const warnings: string[] = [];
    const fitted = await fitPrintCopy({ bytes: tiff, width: 400, height: 400 }, 300, warnings, Math.floor(tiff.length * 0.5));
    expect(fitted.bytes.length).toBeLessThanOrEqual(Math.floor(tiff.length * 0.5));
    expect(fitted.width).toBeLessThan(400);
    expect(warnings).toEqual([`The print copy was reduced from 400 x 400 to ${fitted.width} x ${fitted.height} pixels to fit in storage.`]);
    const same = await fitPrintCopy({ bytes: tiff, width: 400, height: 400 }, null, warnings);
    expect(same.width).toBe(400);
    expect(warnings).toHaveLength(1);
    await expect(fitPrintCopy({ bytes: tiff, width: 400, height: 400 }, null, [], 100)).rejects.toMatchObject({ code: "too_large" });
  });
});
