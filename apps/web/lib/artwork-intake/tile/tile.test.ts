import { describe, expect, it } from "vitest";
import { gradientTile, stripeTile } from "../fixtures/images";
import type { RgbaImage } from "../white-box";
import { findRepeat, measureSeam, makeSeamless, readPixels, repeatImage, SEAM_VERDICT, SEAMLESS_VERDICT, writePng } from "./index";

const pixels = async (bytes: Buffer): Promise<RgbaImage> => readPixels(bytes, 512, 10_000_000);
const flat = (width: number, height: number, value: number): RgbaImage => ({ data: new Uint8Array(width * height * 4).fill(value), width, height });

describe("measureSeam", () => {
  it("shows a seam where opposite edges of a smooth picture differ", async () => {
    const report = measureSeam(await pixels(await gradientTile()));
    expect(report.showsSeam).toBe(true);
    expect(report.verdict).toBe(SEAM_VERDICT);
    expect(report.mismatch).toBeGreaterThan(20);
  });

  it("does not take a stripe edge that the picture itself repeats for a seam", async () => {
    const report = measureSeam(await pixels(await stripeTile()));
    expect(report).toMatchObject({ showsSeam: false, mismatch: 0, verdict: SEAMLESS_VERDICT });
  });

  it("finds nothing wrong with a flat picture, and a picture too thin to judge", () => {
    expect(measureSeam(flat(20, 20, 128)).showsSeam).toBe(false);
    expect(measureSeam(flat(2, 2, 10)).mismatch).toBe(0);
  });

  it("measures each axis on its own", async () => {
    const wide = await pixels(await gradientTile());
    const report = measureSeam(wide);
    expect(report.horizontal).toBeGreaterThan(0);
    expect(report.vertical).toBeGreaterThan(0);
  });
});

describe("makeSeamless", () => {
  it("lowers the mismatch by blending, and the picture is a little smaller", async () => {
    const before = await pixels(await gradientTile(64));
    const after = makeSeamless(before, "blend");
    expect(measureSeam(after).mismatch).toBeLessThan(measureSeam(before).mismatch);
    expect(measureSeam(after).mismatch).toBeLessThan(3);
    expect(after.width).toBeLessThan(before.width);
    expect(after.height).toBeLessThan(before.height);
  });

  it("mirrors 2 x 2 so opposite edges are the same line", async () => {
    const before = await pixels(await gradientTile(32));
    const after = makeSeamless(before, "mirror");
    expect([after.width, after.height]).toEqual([64, 64]);
    expect(measureSeam(after).showsSeam).toBe(false);
  });

  it("mirrors a picture too small to blend", () => {
    const tiny = flat(4, 4, 90);
    expect(makeSeamless(tiny, "blend").width).toBe(8);
  });

  it("returns new pixels and leaves the original alone", async () => {
    const before = await pixels(await gradientTile(32));
    const copy = new Uint8Array(before.data);
    makeSeamless(before, "blend");
    expect([...before.data]).toEqual([...copy]);
  });
});

describe("repeatImage and writePng", () => {
  it("lays the picture out 3 x 3 and writes it as a PNG scaled to fit", async () => {
    const tile = await pixels(await stripeTile(32, 16));
    const grid = repeatImage(tile, 3);
    expect([grid.width, grid.height]).toEqual([96, 96]);
    const png = await writePng(grid, 48);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect((await writePng(grid)).length).toBeGreaterThan(0);
  });
});

describe("findRepeat", () => {
  it("finds the period of stripes", async () => {
    const found = findRepeat(await pixels(await stripeTile(128, 16)));
    expect(found.periodX).toBe(16);
    expect(found.confidence).toBeGreaterThan(0.8);
  });

  it("finds nothing in a flat picture or in a smooth gradient", async () => {
    expect(findRepeat(flat(64, 64, 100))).toEqual({ periodX: null, periodY: null, confidence: 0 });
    expect(findRepeat(await pixels(await gradientTile(64))).periodX).toBeNull();
  });
});
