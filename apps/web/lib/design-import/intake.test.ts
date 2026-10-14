import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { renderTee } from "./fixtures/synthetic";
import { intakePicture, VISION_MAX_BYTES } from "./intake";

vi.setConfig({ testTimeout: 60_000 });

describe("intakePicture", () => {
  it("takes a PNG through W7b and gives the reading model the screen copy", async () => {
    const out = await intakePicture((await renderTee()).png);
    expect(out.mediaType).toBe("image/png");
    expect(out.bytes.byteLength).toBeGreaterThan(100);
    expect(out.notes.every((note) => typeof note === "string" && note.length > 0)).toBe(true);
  });

  it("makes a WebP a PNG first, since artwork intake does not take WebP", async () => {
    const webp = new Uint8Array(await sharp((await renderTee()).png).webp({ lossless: true }).toBuffer());
    expect((await intakePicture(webp)).mediaType).toBe("image/png");
  });

  it("sends a smaller JPEG when the screen copy is more than a vision call takes", async () => {
    // Noise from a fixed seed does not compress, so the screen copy is bigger than a vision call takes.
    let seed = 12345;
    const noise = await sharp(
      Buffer.from(Uint8Array.from({ length: 2000 * 2000 * 3 }, () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0), seed >>> 24))),
      { raw: { width: 2000, height: 2000, channels: 3 } },
    )
      .png({ compressionLevel: 1 })
      .toBuffer();
    const out = await intakePicture(new Uint8Array(noise));
    expect(out.mediaType).toBe("image/jpeg");
    expect(out.bytes.byteLength).toBeLessThanOrEqual(VISION_MAX_BYTES);
  });

  it("refuses a file that is not artwork, in W7b's words", async () => {
    const error = await intakePicture(new Uint8Array([1, 2, 3, 4])).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
  });
});
