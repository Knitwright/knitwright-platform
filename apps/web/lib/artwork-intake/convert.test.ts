import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { applySeamless, checkTile, removeWhite, seamlessPreview, SEAMLESS_LIMIT } from "./convert";
import { logoOnWhite, seamlessWaves, seamyStripes, solidPng } from "./fixtures/pictures";
import { REFUSALS } from "./messages";
import { readRaster } from "./raster/read";

const printOf = async (png: Buffer) => (await readRaster(png, "png")).print.bytes;

describe("removeWhite", () => {
  it("makes the white box see-through, keeps the dpi, and gives a new copy", async () => {
    const print = await printOf(await logoOnWhite());
    const result = await removeWhite(print, 300);
    expect(result.hasAlpha).toBe(true);
    expect(result.dpiMeta).toBe(300);
    expect(result.whiteBackground).toBe(false);
    const { data } = await sharp(result.print.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it("says when there is no white box to remove", async () => {
    await expect(removeWhite(await printOf(await solidPng(20, 20, "#2b46f0")), null)).rejects.toMatchObject({ message: REFUSALS.nothingToRemove });
  });

  it("refuses a picture too big to change here", async () => {
    const big = await sharp({ create: { width: 4100, height: 4100, channels: 3, background: "#fff" } }).tiff({ compression: "deflate" }).toBuffer();
    await expect(removeWhite(big, null)).rejects.toMatchObject({ code: "too_large", message: REFUSALS.convertTooBig });
  });
});

describe("seamless", () => {
  it("shows the mismatch before and after, a 3 x 3 preview and the limit, and stores nothing", async () => {
    const print = await printOf(await seamyStripes(64, 32));
    const preview = await seamlessPreview(print, "blend");
    expect(preview.before.verdict).toBe("The repeat shows a seam.");
    expect(preview.after.mismatch).toBeLessThan(preview.before.mismatch);
    expect(preview.limit).toBe(SEAMLESS_LIMIT);
    const meta = await sharp(preview.preview).metadata();
    expect([meta.width, meta.height]).toEqual([192, 96]);
  });

  it("mirrors to twice the size and refuses when that passes the size limit", async () => {
    const preview = await seamlessPreview(await printOf(await seamlessWaves(20, 10)), "mirror");
    expect([preview.widthPx, preview.heightPx]).toEqual([40, 20]);
    const wide = await sharp({ create: { width: 6500, height: 4, channels: 3, background: "#888" } }).tiff({ compression: "deflate" }).toBuffer();
    await expect(seamlessPreview(wide, "mirror")).rejects.toMatchObject({ code: "too_large" });
  });

  it("becomes a new artwork copy when accepted", async () => {
    const print = await printOf(await seamyStripes());
    const preview = await seamlessPreview(print, "blend");
    const accepted = await applySeamless(preview, 150);
    expect([accepted.widthPx, accepted.heightPx, accepted.dpiMeta]).toEqual([64, 32, 150]);
  });

  it("checks a stored tile as it is", async () => {
    expect((await checkTile(await printOf(await seamlessWaves()))).seamless).toBe(true);
  });
});
