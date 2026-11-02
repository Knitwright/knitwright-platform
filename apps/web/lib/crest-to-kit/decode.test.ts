import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CANNOT_DECODE, crestPixels, crestSize, READ_WIDTH } from "./decode";
import { crestDigest, readCrest } from "./crest";
import { crestColours } from "./palette";
import { kitsCount } from "./words";

/**
 * The one place a crest's bytes are decoded. Every picture here is made by `sharp` in the test, so
 * no picture file is committed: the generator is three flat colours in a row, which is what the
 * palette has to read back.
 */

/** A PNG of three flat vertical bands, so the palette must find exactly those three colours. */
async function bandedPng(colours: readonly [string, string, string], width = 60, height = 20): Promise<Uint8Array> {
  const band = Math.floor(width / 3);
  const data = Buffer.alloc(width * height * 4);
  const byte = (hex: string, at: number): number => Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const hex = colours[Math.min(2, Math.floor(x / band))]!;
      const offset = (y * width + x) * 4;
      data[offset] = byte(hex, 0);
      data[offset + 1] = byte(hex, 1);
      data[offset + 2] = byte(hex, 2);
      data[offset + 3] = 255;
    }
  }
  return new Uint8Array(await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer());
}

const COLOURS = ["#1b2a49", "#d4af37", "#c8102e"] as const;

describe("decoding a crest", () => {
  it("reads a picture's own colours back out of it", async () => {
    const bytes = await bandedPng(COLOURS);
    const read = readCrest("crest.png", bytes, await crestSize(bytes));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const decoded = await crestPixels(read.crest);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const found = crestColours(decoded.pixels).map((one) => one.hex);
    for (const colour of COLOURS) expect(found, colour).toContain(colour);
  });

  it("leaves the crest's own bytes exactly as they were", async () => {
    const bytes = await bandedPng(COLOURS);
    const read = readCrest("crest.png", bytes, null);
    if (!read.ok) return;
    const before = crestDigest(read.crest);
    await crestPixels(read.crest);
    expect(crestDigest(read.crest)).toBe(before);
    expect(read.crest.bytes).toBe(bytes);
  });

  it("reads a picture no wider than the width it reads at", async () => {
    const bytes = await bandedPng(COLOURS, 900, 900);
    const read = readCrest("crest.png", bytes, await crestSize(bytes));
    if (!read.ok) return;
    expect([read.crest.widthPx, read.crest.heightPx]).toEqual([900, 900]);
    const decoded = await crestPixels(read.crest);
    expect(decoded.ok && decoded.pixels.width).toBe(READ_WIDTH);
  });

  it("says plainly that a file is not a picture, rather than throwing", async () => {
    const outcome = await crestPixels({ name: "x.png", format: "png", kind: "raster", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), widthPx: null, heightPx: null });
    expect(outcome).toEqual({ ok: false, reason: CANNOT_DECODE });
    expect(CANNOT_DECODE).toContain("Nothing was stored");
  });

  it("has no size to report for a file it cannot read", async () => {
    expect(await crestSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("the count beside the kits", () => {
  it("names how many and which kits, and says each was checked first", () => {
    expect(kitsCount(1, "home")).toBe("1 kit for home, each one checked against the base article before it was shown.");
    expect(kitsCount(9, "all")).toContain("9 kits for all three");
  });
});
