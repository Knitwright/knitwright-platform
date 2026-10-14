import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { seamlessWaves, seamyStripes } from "../fixtures/pictures";
import { toPixels, type Pixels } from "../raster/pixels";
import { findRepeat, makeSeamless, previewGrid, seamReport } from "./index";

const pixelsOf = (png: Buffer) => toPixels(png, 4_000_000);

describe("seamReport", () => {
  it("gives a seam in plain words, with a mismatch number, for a tile whose edges differ", async () => {
    const report = seamReport(await pixelsOf(await seamyStripes()));
    expect(report.verdict).toBe("The repeat shows a seam.");
    expect(report.seamless).toBe(false);
    expect(report.mismatch).toBeGreaterThan(15);
    expect(report.horizontal).toBeGreaterThan(report.vertical);
  });

  it("calls a tile that repeats exactly seamless", async () => {
    const report = seamReport(await pixelsOf(await seamlessWaves()));
    expect(report.seamless).toBe(true);
    expect(report.verdict).toBe("The repeat looks seamless.");
    expect(report.mismatch).toBeLessThan(5);
  });
});

describe("makeSeamless", () => {
  it("lowers the mismatch by offset and blend, and says nothing about the size changing", async () => {
    const tile = await pixelsOf(await seamyStripes());
    const before = seamReport(tile);
    const fixed = makeSeamless(tile, "blend");
    const after = seamReport(fixed);
    expect([fixed.width, fixed.height]).toEqual([tile.width, tile.height]);
    expect(after.mismatch).toBeLessThan(before.mismatch);
    expect(after.mismatch).toBeLessThan(5);
  });

  it("makes a 2 x 2 mirror that is twice the size and seamless", async () => {
    const tile = await pixelsOf(await seamyStripes());
    const fixed = makeSeamless(tile, "mirror");
    expect([fixed.width, fixed.height]).toEqual([tile.width * 2, tile.height * 2]);
    expect(seamReport(fixed).mismatch).toBe(0);
    // The right half is the left half turned over.
    expect(fixed.data.subarray((fixed.width - 1) * 3, fixed.width * 3)).toEqual(tile.data.subarray(0, 3));
  });

  it("does not change its input, and gives the same result twice", async () => {
    const tile = await pixelsOf(await seamyStripes());
    const copy = Uint8Array.from(tile.data);
    const a = makeSeamless(tile, "blend");
    const b = makeSeamless(tile, "blend");
    expect(tile.data).toEqual(copy);
    expect(a.data).toEqual(b.data);
  });

  it("handles a picture with an alpha channel and a one pixel wide picture", () => {
    const rgba: Pixels = { data: new Uint8Array(4 * 4 * 4).fill(100), width: 4, height: 4, channels: 4 };
    expect(makeSeamless(rgba, "blend").channels).toBe(4);
    const thin: Pixels = { data: Uint8Array.from([1, 2, 3]), width: 1, height: 1, channels: 3 };
    expect(makeSeamless(thin, "blend").data).toHaveLength(3);
  });
});

describe("previewGrid", () => {
  it("lays the tile out 3 x 3", async () => {
    const tile = await pixelsOf(await seamlessWaves(40, 20));
    const meta = await sharp(await previewGrid(tile)).metadata();
    expect([meta.width, meta.height]).toEqual([120, 60]);
  });

  it("shrinks a large tile so the preview stays small", async () => {
    const big: Pixels = { data: new Uint8Array(900 * 600 * 3).fill(128), width: 900, height: 600, channels: 3 };
    const meta = await sharp(await previewGrid(big)).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1200);
  });
});

describe("findRepeat", () => {
  /** Dots every `px` by `py` pixels on a field, in a picture of `width` x `height`. */
  const dots = (width: number, height: number, px: number, py: number): Pixels => {
    const data = new Uint8Array(width * height * 3).fill(255);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = (x % px) - px / 2;
        const dy = (y % py) - py / 2;
        if (dx * dx + dy * dy < (Math.min(px, py) / 4) ** 2) data.set([20, 40, 200], (y * width + x) * 3);
      }
    }
    return { data, width, height, channels: 3 };
  };

  it("finds the repeat along both axes", async () => {
    const found = await findRepeat(dots(200, 180, 40, 30));
    expect(found.periodX).toBe(40);
    expect(found.periodY).toBe(30);
    expect(found.confidenceX).toBeGreaterThan(0.8);
  });

  it("scales the answer back when the picture is bigger than the working size", async () => {
    const found = await findRepeat(dots(800, 600, 200, 150));
    expect(Math.abs((found.periodX ?? 0) - 200)).toBeLessThanOrEqual(4);
    expect(Math.abs((found.periodY ?? 0) - 150)).toBeLessThanOrEqual(4);
  });

  it("finds no repeat in noise-free flat colour or in a one way gradient", async () => {
    const flat: Pixels = { data: new Uint8Array(60 * 60 * 3).fill(80), width: 60, height: 60, channels: 3 };
    expect(await findRepeat(flat)).toEqual({ periodX: null, periodY: null, confidenceX: 0, confidenceY: 0 });
    const ramp = await pixelsOf(await seamyStripes(64, 32));
    expect((await findRepeat(ramp)).periodX).toBeNull();
  });

  it("is the same twice", async () => {
    const picture = dots(120, 120, 30, 30);
    expect(await findRepeat(picture)).toEqual(await findRepeat(picture));
  });
});
