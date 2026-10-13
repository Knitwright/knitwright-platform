import { describe, expect, it } from "vitest";
import { ProviderError } from "./image-provider";
import { imageProviderFrom } from "./index";
import { failingImageProvider, stubImageProvider } from "./image-stub";

describe("imageProviderFrom", () => {
  it("is null without a key, so the feature is shown as unavailable", () => {
    expect(imageProviderFrom({ GEMINI_API_KEY: undefined })).toBeNull();
  });

  it("is the Gemini model when a key is set", () => {
    expect(imageProviderFrom({ GEMINI_API_KEY: "k" })?.name).toMatch(/^gemini:/);
  });

  it("is fal when only its key is set, and Google first when both are", () => {
    expect(imageProviderFrom({ FAL_KEY: "k" })?.name).toMatch(/^fal:/);
    expect(imageProviderFrom({ GEMINI_API_KEY: "g", FAL_KEY: "f" })?.name).toMatch(/^gemini:/);
  });

  it("follows IMAGE_PROVIDER, and is null when the named provider has no key", () => {
    expect(imageProviderFrom({ GEMINI_API_KEY: "g", FAL_KEY: "f", IMAGE_PROVIDER: "fal" })?.name).toMatch(/^fal:/);
    expect(imageProviderFrom({ GEMINI_API_KEY: "g", FAL_KEY: "f", IMAGE_PROVIDER: "gemini" })?.name).toMatch(/^gemini:/);
    expect(imageProviderFrom({ GEMINI_API_KEY: "g", IMAGE_PROVIDER: "fal" })).toBeNull();
    expect(imageProviderFrom({ FAL_KEY: "f", IMAGE_PROVIDER: "gemini" })).toBeNull();
  });
});

describe("stubs", () => {
  it("answers with a PNG and remembers the request", async () => {
    const stub = stubImageProvider();
    const image = await stub.generate({ prompt: "p", reference: new Uint8Array([1]) });

    expect([...image.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(stub.requests.map((request) => request.prompt)).toEqual(["p"]);
  });

  it("can always fail", async () => {
    await expect(
      failingImageProvider(true).generate({ prompt: "p", reference: new Uint8Array() }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
