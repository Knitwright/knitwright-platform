import { describe, expect, it, vi } from "vitest";
import { FAL_IMAGE_MODEL, createFalProvider } from "./fal";
import { ProviderError } from "./image-provider";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const OUT = Buffer.from([9, 8, 7, 6]).toString("base64");

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const withImage = (url = `data:image/png;base64,${OUT}`) => ({
  images: [{ url, content_type: "image/png" }],
  description: "",
});

const call = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls[0] as unknown as [string, RequestInit];

describe("createFalProvider", () => {
  it("sends the prompt and the flat as a data address, with the key in a header", async () => {
    const fetcher = vi.fn(async () => answer(withImage()));
    const provider = createFalProvider({ apiKey: "secret-key", fetch: fetcher });

    await provider.generate({ prompt: "A tee", reference: PNG });

    const [url, init] = call(fetcher);
    expect(url).toBe(`https://fal.run/${FAL_IMAGE_MODEL}`);
    expect(url).not.toContain("secret-key");
    expect(new Headers(init.headers).get("authorization")).toBe("Key secret-key");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      prompt: "A tee",
      image_urls: [`data:image/png;base64,${Buffer.from(PNG).toString("base64")}`],
      num_images: 1,
      aspect_ratio: "1:1",
      resolution: "1K",
      output_format: "png",
      sync_mode: true,
    });
  });

  it("asks fal not to keep the request or the picture (docs/data-processing.md)", async () => {
    const fetcher = vi.fn(async () => answer(withImage()));

    await createFalProvider({ apiKey: "k", fetch: fetcher }).generate({ prompt: "p", reference: PNG });

    const headers = new Headers(call(fetcher)[1].headers);
    expect(headers.get("x-fal-store-io")).toBe("0");
    expect(JSON.parse(headers.get("x-fal-object-lifecycle-preference") ?? "{}")).toEqual({ expiration_duration_seconds: 600 });
  });

  it("returns the picture's bytes from the data address", async () => {
    const provider = createFalProvider({ apiKey: "k", fetch: async () => answer(withImage()) });

    const image = await provider.generate({ prompt: "p", reference: PNG });

    expect([...image.bytes]).toEqual([9, 8, 7, 6]);
    expect(image.contentType).toBe("image/png");
  });

  it("fetches the picture when fal answers with an address on its own file host", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.startsWith("https://fal.run/")
        ? answer(withImage("https://v3.fal.media/files/abc/out.png"))
        : new Response(Buffer.from([1, 2]), { headers: { "content-type": "image/png" } }),
    );

    const image = await createFalProvider({ apiKey: "k", fetch: fetcher }).generate({ prompt: "p", reference: PNG });

    expect([...image.bytes]).toEqual([1, 2]);
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://v3.fal.media/files/abc/out.png");
  });

  it("refuses to fetch a picture from anywhere but fal's file host", async () => {
    const fetcher = vi.fn(async () => answer(withImage("http://169.254.169.254/latest/meta-data")));

    const error = await createFalProvider({ apiKey: "k", fetch: fetcher })
      .generate({ prompt: "p", reference: PNG })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails when the answer holds no picture", async () => {
    const provider = createFalProvider({ apiKey: "k", fetch: async () => answer({ images: [], description: "" }) });

    await expect(provider.generate({ prompt: "p", reference: PNG })).rejects.toBeInstanceOf(ProviderError);
  });

  it("fails on a picture that is too large", async () => {
    const huge = "A".repeat(28 * 1024 * 1024);
    const provider = createFalProvider({ apiKey: "k", fetch: async () => answer(withImage(`data:image/png;base64,${huge}`)) });

    await expect(provider.generate({ prompt: "p", reference: PNG })).rejects.toThrow(/too large/);
  });

  it("says a refused key or account cannot be helped by a retry, and a rate limit can", async () => {
    for (const [status, refused] of [
      [401, true],
      [403, true],
      [422, true],
      [429, false],
      [500, false],
    ] as const) {
      const provider = createFalProvider({ apiKey: "k", fetch: async () => answer({ detail: "nope" }, status) });
      const error = await provider.generate({ prompt: "p", reference: PNG }).catch((e) => e);

      expect(error).toBeInstanceOf(ProviderError);
      expect(error.refused).toBe(refused);
      expect(error.message).not.toContain("nope");
    }
  });

  it("fails without retry promise when fal cannot be reached", async () => {
    const provider = createFalProvider({
      apiKey: "k",
      fetch: async () => {
        throw new TypeError("network down");
      },
    });

    const error = await provider.generate({ prompt: "p", reference: PNG }).catch((e) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.refused).toBe(false);
  });

  it("names the model in its logs name", () => {
    expect(createFalProvider({ apiKey: "k" }).name).toBe(`fal:${FAL_IMAGE_MODEL}`);
  });
});
