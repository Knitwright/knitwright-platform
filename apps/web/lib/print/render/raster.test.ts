import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { rasterScene, vectorScene } from "./fixtures";
import { RASTER_PIXEL_CAP, flattenScene, layerGroups, pixelGrid, rasterise } from "./raster";

const ALL = { background: "#ffffff", art: true, guides: true, margin: true } as const;

const pixel = async (png: Uint8Array, x: number, y: number): Promise<number[]> => {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return [...data.subarray(at, at + info.channels)];
};

/** The pixel under a scene point (millimetres), for the vector fixture whose page corner is (7, 223). */
const atScene = (png: Uint8Array, dpi: number, x: number, y: number): Promise<number[]> =>
  pixel(png, Math.round(((x - 7) / 25.4) * dpi), Math.round(((223 - y) / 25.4) * dpi));

describe("pixelGrid", () => {
  it("keeps the resolution when the page fits", () => {
    expect(pixelGrid(vectorScene(), 50, RASTER_PIXEL_CAP)).toMatchObject({ widthPx: 602, heightPx: 406, dpi: 50, dpiNote: null });
  });

  it("lowers the resolution to a whole number and says so", () => {
    const grid = pixelGrid(vectorScene(), 150, 1_000_000);
    expect(grid.dpi).toBeLessThan(150);
    expect(Number.isInteger(grid.dpi)).toBe(true);
    expect(grid.widthPx * grid.heightPx).toBeLessThanOrEqual(1_000_000);
    expect(grid.dpiNote).toBe(`Resolution lowered from 150 to ${grid.dpi} dpi so the file fits the size limit.`);
  });

  it("never goes below one dpi", () => {
    expect(pixelGrid(vectorScene(), 150, 1).dpi).toBe(1);
  });

  it("has a 60 million pixel cap", () => {
    expect(RASTER_PIXEL_CAP).toBe(60_000_000);
  });
});

describe("layerGroups", () => {
  it("groups runs of one layer in order", () => {
    const groups = layerGroups(vectorScene().items);
    expect(groups.map((group) => group[0]?.layerId)).toEqual(["ground", "dots", "logo", "line"]);
    expect(groups[1]).toHaveLength(4);
  });
});

describe("rasterise", () => {
  it("draws a vector scene on white at the asked size", async () => {
    const result = await rasterise(vectorScene(), ALL);
    expect(result).toMatchObject({ widthPx: 602, heightPx: 406, dpi: 50 });
    expect((await atScene(result.png, 50, 90, 200)).slice(0, 3)).toEqual([240, 240, 240]);
    expect((await atScene(result.png, 50, 130, 170)).slice(0, 3)).toEqual([204, 0, 0]);
    expect((await atScene(result.png, 50, 160, 150)).slice(0, 3)).toEqual([240, 240, 240]);
    const bare = await rasterise({ ...vectorScene(), items: [] }, ALL);
    expect((await atScene(bare.png, 50, 90, 200)).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it("works in several strips when the page is bigger than a strip", async () => {
    const big = { ...vectorScene(), dpi: 500 };
    const result = await rasterise(big, { ...ALL, pixelCap: 6_000_000 });
    expect(result.widthPx * result.heightPx).toBeLessThanOrEqual(6_000_000);
    expect(result.dpiNote).not.toBeNull();
    expect((await sharp(result.png).metadata()).height).toBe(result.heightPx);
  });

  it("leaves a clear page when nothing is asked for", async () => {
    const result = await rasterise(vectorScene(), { background: null, art: false, guides: false, margin: false });
    expect((await pixel(result.png, 10, 10))[3]).toBe(0);
  });
});

describe("flattenScene", () => {
  it("blends a multiply layer over the layers below it", async () => {
    const flat = await flattenScene(rasterScene());
    expect(flat.dpi).toBe(20);
    // Inside the multiply rectangle and inside the ground: #f0f0f0 x #8888ff at 0.9 over, away from dots and logo.
    const [r, g, b, a] = await atScene(flat.png, 20, 80, 130);
    expect(a).toBe(255);
    expect(r).toBeLessThan(160);
    expect(g).toBeLessThan(160);
    expect(b).toBeGreaterThan(r + 60);
  });

  it("composites screen and overlay layers too", async () => {
    const scene = rasterScene();
    const items = scene.items.map((item) => (item.layerId === "shade" ? { ...item, blend: "screen" as const } : item));
    const screen = await flattenScene({ ...scene, items });
    const [r] = await atScene(screen.png, 20, 80, 130);
    expect(r).toBeGreaterThan(230);
    const overlay = await flattenScene({ ...scene, items: items.map((item) => (item.layerId === "shade" ? { ...item, blend: "overlay" as const } : item)) });
    expect((await atScene(overlay.png, 20, 80, 130))[3]).toBe(255);
  });

  it("rasterises a raster scene with a background, guides and margin in layers", async () => {
    const result = await rasterise({ ...rasterScene(), items: [] }, ALL);
    expect((await atScene(result.png, 20, 90, 200)).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it("is repeatable", async () => {
    const a = await flattenScene(rasterScene());
    const b = await flattenScene(rasterScene());
    expect(Buffer.compare(Buffer.from(a.png), Buffer.from(b.png))).toBe(0);
  });
});
