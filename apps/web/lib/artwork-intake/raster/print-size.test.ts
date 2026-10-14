import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ maxPrint: 48 * 1024 * 1024 }));

vi.mock("../settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../settings")>();
  return { ...actual, INTAKE_LIMITS: { ...actual.INTAKE_LIMITS, get maxPrintCopyBytes() { return state.maxPrint; } } };
});

import { REFUSALS } from "../messages";
import { readRaster } from "./read";

/** A soft gradient with a little grain: a photograph's kind of picture, which JPEG keeps smaller than deflate does. */
const noise = (width: number, height: number, channels: 3 | 4) => {
  const data = Buffer.alloc(width * height * channels);
  let seed = 7;
  for (let i = 0; i < data.length; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const pixel = Math.floor(i / channels);
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[i] = Math.min(255, Math.round(128 + 100 * Math.sin(x / 40) * Math.cos(y / 55)) + ((seed >> 16) & 3));
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
};

describe("a print copy that is too big to keep", () => {
  it("is kept as high quality JPEG in a TIFF when it has no see-through parts and that fits", async () => {
    const picture = await noise(400, 400, 3);
    const lossless = (await readRaster(picture, "png")).print.bytes.byteLength;
    state.maxPrint = Math.floor(lossless * 0.6);
    const result = await readRaster(picture, "png");
    expect(result.print.bytes.byteLength).toBeLessThanOrEqual(state.maxPrint);
    expect(result.print.bytes.byteLength).toBeLessThan(lossless);
    expect((await sharp(result.print.bytes).metadata()).format).toBe("tiff");
    state.maxPrint = 48 * 1024 * 1024;
  });

  it("is refused when it has see-through parts, or when even the lossy copy is too big", async () => {
    state.maxPrint = 500;
    await expect(readRaster(await noise(120, 120, 4), "png")).rejects.toMatchObject({ code: "too_large", message: REFUSALS.printCopyTooBig });
    await expect(readRaster(await noise(120, 120, 3), "png")).rejects.toMatchObject({ code: "too_large", message: REFUSALS.printCopyTooBig });
    state.maxPrint = 48 * 1024 * 1024;
  });
});
