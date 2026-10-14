import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ProviderError, type ImageProvider } from "@/lib/providers";
import { createImageCleanup } from "./cleanup-image";
import { createRaster } from "./raster";

const providerReturning = async (): Promise<ImageProvider & { requests: { prompt: string; reference: Uint8Array }[] }> => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer();
  const requests: { prompt: string; reference: Uint8Array }[] = [];
  return { name: "test", requests, generate: async (request) => (requests.push(request), { bytes: new Uint8Array(png), contentType: "image/png" }) };
};

describe("createImageCleanup", () => {
  it("sends the picture as a PNG with a fixed prompt for the task, and decodes what comes back", async () => {
    const provider = await providerReturning();
    const cleanup = createImageCleanup(provider);
    const result = await cleanup.run(createRaster(16, 12), "flatten-photo");
    expect(result.width).toBe(8);
    expect(provider.requests[0].prompt).toMatch(/flat/i);
    expect(provider.requests[0].reference.slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
    await cleanup.run(createRaster(16, 12), "remove-person-or-hanger");
    expect(provider.requests[1].prompt).toMatch(/hanger/i);
    expect(provider.requests[1].prompt).not.toBe(provider.requests[0].prompt);
  });

  it("fails with the provider's error, or with a plain one when the answer is not a picture", async () => {
    const down: ImageProvider = { name: "x", generate: async () => { throw new ProviderError("down", false); } };
    await expect(createImageCleanup(down).run(createRaster(4, 4), "flatten-photo")).rejects.toBeInstanceOf(ProviderError);
    const junk: ImageProvider = { name: "x", generate: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" }) };
    await expect(createImageCleanup(junk).run(createRaster(4, 4), "flatten-photo")).rejects.toThrow(/not a picture/i);
  });
});
