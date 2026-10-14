import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { intakeArtwork } from "@/lib/artwork-intake";
import { cropFile, cutPicture, LEAST_STATED_DPI, maskRaster, MOST_CUT_PX } from "./cuts";
import { trueFit } from "./fixtures/known";
import { blankRaster, filledRect } from "./raster";
import type { PictureCut } from "./pattern";

const picture = filledRect(blankRaster(400, 400, [200, 16, 46]), { x0: 200, y0: 0, x1: 400, y1: 400 }, [255, 255, 255]);
const fit = trueFit();
const area = { minX: -150, minY: 0, maxX: 150, maxY: 150 };
const cutOfArea = (clip: boolean, over: Partial<PictureCut["area"]> = {}): PictureCut => ({ assetId: "tile-front", view: "front", area: { ...area, ...over }, clip });

describe("cutPicture", () => {
  it("cuts a block at the picture's own sharpness, and states the size it was cut at", async () => {
    const mask = maskRaster(new Uint8Array(400 * 400).fill(1), 400, 400);
    const out = await cutPicture(cutOfArea(false), { raster: picture, scale: 1, fit, mask, generated: false });
    expect(out).toMatchObject({ assetId: "tile-front", view: "front", widthMm: 300, generated: false });
    // 1.5 mm to a pixel is 17 dpi, which a PNG cannot state (50 is the least), so the layer is scaled up by 50 / 17.
    expect(out.widthPx).toBe(Math.round(300 / fit.mmPerPixel));
    // Left of the centre line is red, right of it white.
    const { data, info } = await sharp(out.png).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([200, 16, 46]);
    expect(data[(info.width - 1) * info.channels]).toBe(255);
    expect(out.scale).toBeCloseTo((LEAST_STATED_DPI * fit.mmPerPixel) / 25.4, 3);
    // W7b reads the stated size back from the file; scaled by the layer's scale, the tile prints at the size it was cut at.
    const intake = await intakeArtwork(out.png, "tile.png");
    expect(intake.dpiMeta).toBe(LEAST_STATED_DPI);
    expect(Math.abs(((intake.widthPx / LEAST_STATED_DPI) * 25.4) * out.scale - 300)).toBeLessThan(3);
  });

  it("states the true resolution, and scales by 1, when the picture is sharp enough for a PNG to say so", async () => {
    const mask = maskRaster(new Uint8Array(400 * 400).fill(1), 400, 400);
    const sharpFit = { ...fit, mmPerPixel: 0.25 };
    const out = await cutPicture(cutOfArea(false, { minX: 0, maxX: 100, minY: 0, maxY: 50 }), { raster: picture, scale: 1, fit: sharpFit, mask, generated: false });
    expect(out.scale).toBeCloseTo(1, 1);
    expect((await intakeArtwork(out.png, "tile.png")).dpiMeta).toBe(Math.round(25.4 / 0.25));
  });

  it("clears what is off the garment for a full panel, and flags generated pixels", async () => {
    const half = new Uint8Array(400 * 400);
    for (let at = 0; at < half.length; at += 1) half[at] = at % 400 < 200 ? 1 : 0;
    const out = await cutPicture(cutOfArea(true), { raster: picture, scale: 1, fit, mask: maskRaster(half, 400, 400), generated: true });
    const { data, info } = await sharp(out.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(255);
    expect(data[(info.width - 1) * 4 + 3]).toBe(0);
    expect(out.generated).toBe(true);
  });

  it("clears pixels outside the picture, and holds a cut to the most it may be", async () => {
    const mask = maskRaster(new Uint8Array(400 * 400).fill(1), 400, 400);
    const far = await cutPicture(cutOfArea(false, { minX: 5000, maxX: 5100, minY: 5000, maxY: 5100 }), { raster: picture, scale: 1, fit, mask, generated: false });
    const { data } = await sharp(far.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    const big = await cutPicture(cutOfArea(false, { minX: -2000, maxX: 2000, minY: 0, maxY: 100 }), { raster: picture, scale: 1, fit: { ...fit, mmPerPixel: 0.01 }, mask, generated: false });
    expect(Math.max(big.widthPx, big.heightPx)).toBeLessThanOrEqual(MOST_CUT_PX);
  });
});

describe("cropFile", () => {
  it("cuts a rectangle of the analysis picture out of the better copy of it", async () => {
    const better = blankRaster(800, 800, [10, 20, 30]);
    const out = await cropFile({ assetId: "crop-1", view: "front", rect: { x0: 10, y0: 20, x1: 50, y1: 60 } }, { raster: better, scale: 2 });
    expect(out).toMatchObject({ assetId: "crop-1", view: "front" });
    const meta = await sharp(out.png).metadata();
    expect([meta.width, meta.height]).toEqual([80, 80]);
    const edge = await cropFile({ assetId: "crop-2", view: "back", rect: { x0: 390, y0: 390, x1: 420, y1: 420 } }, { raster: better, scale: 2 });
    expect((await sharp(edge.png).metadata()).width).toBe(20);
  });
});
