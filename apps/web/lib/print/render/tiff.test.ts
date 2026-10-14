import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { rasterScene, vectorScene } from "./fixtures";
import { renderTiff } from "./tiff";

const srgbProfile = async (): Promise<Uint8Array> => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#808080" } }).withIccProfile("srgb").png().toBuffer();
  const icc = (await sharp(png).metadata()).icc;
  if (!icc) throw new Error("no profile");
  return new Uint8Array(icc);
};

describe("renderTiff", () => {
  it("has the page size in pixels, the density and three channels", async () => {
    const result = await renderTiff(vectorScene());
    expect(result).toMatchObject({ widthPx: 602, heightPx: 406, dpi: 50, dpiNote: null });
    const meta = await sharp(result.bytes).metadata();
    expect(meta).toMatchObject({ format: "tiff", width: 602, height: 406, density: 50, channels: 3, hasAlpha: false });
  });

  it("is on white where nothing is drawn, with the guides drawn", async () => {
    const result = await renderTiff({ ...vectorScene(), items: [] });
    const { data, info } = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true });
    const row = Math.round((3 / 25.4) * 50);
    const at = (row * info.width + 300) * info.channels;
    expect([...data.subarray((10 * info.width + 10) * info.channels, (10 * info.width + 10) * info.channels + 3)]).toEqual([255, 255, 255]);
    expect([...data.subarray(at, at + 3)]).not.toEqual([255, 255, 255]);
  });

  it("embeds the profile it is given", async () => {
    const result = await renderTiff(vectorScene(), { icc: await srgbProfile() });
    const meta = await sharp(result.bytes).metadata();
    expect(meta.hasProfile).toBe(true);
    expect(meta.icc?.length).toBeGreaterThan(100);
  });

  it("is byte-identical across runs, with and without a profile", async () => {
    const icc = await srgbProfile();
    for (const options of [{}, { icc }]) {
      const a = await renderTiff(rasterScene(), options);
      const b = await renderTiff(rasterScene(), options);
      expect(Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes))).toBe(0);
    }
  });

  it("lowers the resolution under a pixel cap and says so", async () => {
    const result = await renderTiff({ ...vectorScene(), dpi: 150 }, { pixelCap: 100_000 });
    expect(result.dpi).toBeLessThan(150);
    expect(result.widthPx * result.heightPx).toBeLessThanOrEqual(100_000);
    expect(result.dpiNote).toContain("Resolution lowered from 150 to");
    expect((await sharp(result.bytes).metadata()).density).toBe(result.dpi);
  });
});
