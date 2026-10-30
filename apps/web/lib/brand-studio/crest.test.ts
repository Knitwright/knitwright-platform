import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deltaE } from "@/lib/print/rules/colour";
import { CREST_COLOURS, crestPalette, type CrestSource } from "./crest";

/**
 * Starting from a crest. The fixtures are drawn here: no third-party crest is committed
 * (plan v5 Z6).
 */

/** A PNG of horizontal bands, as a stored screen copy would be. */
const crest = async (bands: readonly (readonly [string, number])[], alpha = 1): Promise<Buffer> => {
  const width = 40;
  const height = bands.reduce((sum, [, rows]) => sum + rows, 0);
  const rects = bands.map(([hex, rows], at) => {
    const top = bands.slice(0, at).reduce((sum, [, before]) => sum + before, 0);
    return `<rect x="0" y="${top}" width="${width}" height="${rows}" fill="${hex}" fill-opacity="${alpha}" />`;
  });
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects.join("")}</svg>`))
    .png()
    .toBuffer();
};

const source = (bytes: Buffer, kind: "raster" | "vector" = "raster"): CrestSource => ({
  kind,
  readScreenCopy: async () => new Uint8Array(bytes),
});

describe("crestPalette", () => {
  it("reads a two-colour crest as its two colours, the larger band first", async () => {
    const palette = await crestPalette(source(await crest([["#0b1f4b", 30], ["#ffd100", 10]])), 2);
    expect(palette).toHaveLength(2);
    expect(deltaE(palette[0]!.hex, "#0b1f4b")).toBeLessThan(5);
    expect(deltaE(palette[1]!.hex, "#ffd100")).toBeLessThan(5);
    expect(palette[0]!.share).toBeGreaterThan(palette[1]!.share);
  });

  it("asks for five colours unless told otherwise", async () => {
    const bands = [["#0b1f4b", 10], ["#ffd100", 8], ["#c8102e", 6], ["#ffffff", 4], ["#00843d", 2], ["#7a5230", 2]] as const;
    expect(await crestPalette(source(await crest(bands)))).toHaveLength(CREST_COLOURS);
  });

  it("pairs each colour with the sublimation estimate's answer", async () => {
    const palette = await crestPalette(source(await crest([["#0000ff", 20], ["#0b1f4b", 20]])), 2);
    const electric = palette.find((swatch) => !swatch.inGamut);
    expect(electric).toBeDefined();
    expect(electric!.safeHex).not.toBe(electric!.hex);
    expect(electric!.warning).toContain("Knitwright's own estimate");
    const navy = palette.find((swatch) => swatch.inGamut);
    expect(navy!.warning).toBeNull();
    expect(navy!.safeHex).toBe(navy!.hex);
  });

  it("reads a drawing's screen copy the same way as a picture's", async () => {
    const palette = await crestPalette(source(await crest([["#c8102e", 20]]), "vector"), 1);
    expect(deltaE(palette[0]!.hex, "#c8102e")).toBeLessThan(5);
  });

  it("has no palette for an upload with nothing but transparent pixels", async () => {
    const empty = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    expect(await crestPalette(source(empty))).toEqual([]);
  });

  it("gives the same palette for the same crest, every run", async () => {
    const bytes = await crest([["#0b1f4b", 20], ["#ffd100", 12], ["#c8102e", 8]]);
    expect(await crestPalette(source(bytes), 3)).toEqual(await crestPalette(source(bytes), 3));
  });
});
