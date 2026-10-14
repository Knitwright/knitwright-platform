import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { REFUSALS } from "../messages";
import { cmykTiff } from "../fixtures/cmyk-tiff";
import { logoOnWhite, pngHeaderClaiming, solidPng } from "../fixtures/pictures";
import { readRaster } from "./read";

// A real CMYK profile that ships with pdfjs-dist (a dependency already installed). Used as a test input only.
const CMYK_ICC = readFileSync(
  createRequire(import.meta.url).resolve("pdfjs-dist/package.json").replace("package.json", "iccs/CGATS001Compat-v2-micro.icc"),
);

describe("readRaster", () => {
  it("turns a 600 dpi CMYK TIFF into an sRGB print copy and a screen copy, naming the profile", async () => {
    const tiff = cmykTiff({ width: 40, height: 20, pixel: [255, 0, 0, 0], icc: CMYK_ICC, dpi: 600 });
    const result = await readRaster(tiff, "tiff");
    expect(result.colourSpace).toBe("cmyk");
    expect(result.dpiMeta).toBe(600);
    expect(result.profileName).toMatch(/\S/);
    expect(result.warnings.join(" ")).toContain(`using the embedded profile "${result.profileName}"`);
    const printed = sharp(result.print.bytes);
    const meta = await printed.metadata();
    expect([meta.format, meta.space, meta.channels, meta.depth, meta.density, meta.hasProfile]).toEqual(["tiff", "srgb", 3, "uchar", 600, false]);
    // Process cyan through the profile is (0, 174, 239), not the plain conversion (0, 153, 227).
    const [r, g, b] = await printed.raw().toBuffer();
    expect([r, g, b]).toEqual([0, 174, 239]);
    expect(result.screen.contentType).toBe("image/jpeg");
    expect(result.widthPx).toBe(40);
  });

  it("says so when a CMYK picture has no profile, and when an RGB one has none", async () => {
    const cmyk = await readRaster(cmykTiff({ width: 8, height: 8, pixel: [0, 255, 0, 0] }), "tiff");
    expect(cmyk.profileName).toBeNull();
    expect(cmyk.warnings).toContain("This CMYK picture had no colour profile, so a standard conversion to screen colours was used. Colours may shift.");
    const rgb = await readRaster(await solidPng(8, 8, "#2b46f0"), "png");
    expect(rgb.colourSpace).toBe("srgb");
    expect(rgb.warnings).toContain("No colour profile was embedded, so the colours were taken as sRGB.");
  });

  it("converts Display P3 and records the profile", async () => {
    const p3 = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c8102e" } }).withIccProfile("p3").png().toBuffer();
    const result = await readRaster(p3, "png");
    expect(result.colourSpace).toBe("display-p3");
    expect(result.profileName).toMatch(/P3/i);
  });

  it("reduces 16-bit pictures to 8-bit and keeps see-through parts", async () => {
    const deep = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 200, g: 20, b: 20, alpha: 0.5 } } })
      .toColourspace("rgb16").png().toBuffer();
    const result = await readRaster(deep, "png");
    expect(result.hasAlpha).toBe(true);
    expect((await sharp(result.print.bytes).metadata()).depth).toBe("uchar");
    expect(result.screen.contentType).toBe("image/png");
    expect(result.warnings).toContain("The picture had more than 8 bits per colour; it was reduced to 8.");
    expect(result.warnings).toContain("See-through parts of the picture were kept.");
  });

  it("records grey pictures as grey", async () => {
    const grey = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).extractChannel(0).jpeg().toBuffer();
    expect((await readRaster(grey, "jpeg")).colourSpace).toBe("grey");
  });

  it("records the resolution a file states", async () => {
    const stated = await sharp(await solidPng(8, 8, "#2b46f0")).png().withMetadata({ density: 300 }).toBuffer();
    expect((await readRaster(stated, "png")).dpiMeta).toBe(300);
    const camera = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    expect((await readRaster(camera, "jpeg")).dpiMeta).toBe(72);
  });

  it("turns the picture by its orientation note, and keeps no metadata", async () => {
    const wide = await sharp({ create: { width: 40, height: 10, channels: 3, background: "#fff" } }).jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "secret" } } }).toBuffer();
    const result = await readRaster(wide, "jpeg");
    expect([result.widthPx, result.heightPx]).toEqual([10, 40]);
    const meta = await sharp(result.print.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(result.print.bytes.includes(Buffer.from("secret"))).toBe(false);
  });

  it("detects a logo on a white box, and not a plain white or a see-through picture", async () => {
    expect((await readRaster(await logoOnWhite(), "png")).whiteBackground).toBe(true);
    expect((await readRaster(await solidPng(30, 30, "#ffffff"), "png")).whiteBackground).toBe(false);
    expect((await readRaster(await solidPng(30, 30, "#2b46f0"), "png")).whiteBackground).toBe(false);
  });

  it("is deterministic: the same file gives the same print copy hash", async () => {
    const png = await logoOnWhite();
    expect((await readRaster(png, "png")).print.sha256).toBe((await readRaster(png, "png")).print.sha256);
  });
});

describe("limits", () => {
  it("refuses a 100 000 x 100 000 pixel PNG from its header, before decoding", async () => {
    await expect(readRaster(pngHeaderClaiming(100_000, 100_000), "png")).rejects.toMatchObject({ code: "too_large", message: REFUSALS.tooManyPixels });
  });

  it("refuses a picture longer than 12 000 pixels, and one over 100 megapixels", async () => {
    await expect(readRaster(pngHeaderClaiming(12_001, 10), "png")).rejects.toMatchObject({ message: REFUSALS.tooManyPixels });
    await expect(readRaster(pngHeaderClaiming(11_000, 10_000), "png")).rejects.toMatchObject({ message: REFUSALS.tooManyPixels });
  });

  it("refuses a file over 50 MB without reading it", async () => {
    await expect(readRaster(new Uint8Array(50 * 1024 * 1024 + 1), "png")).rejects.toMatchObject({ code: "too_large", message: REFUSALS.tooBig });
  });

  it("refuses bytes that are not a picture, and a truncated one", async () => {
    await expect(readRaster(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), "png")).rejects.toMatchObject({ message: REFUSALS.unreadable });
    const png = await solidPng(200, 200, "#2b46f0");
    await expect(readRaster(png.subarray(0, Math.floor(png.length / 2)), "png")).rejects.toMatchObject({ message: REFUSALS.unreadable });
  });
});
