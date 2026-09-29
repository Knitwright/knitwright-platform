import { describe, expect, it, vi } from "vitest";
import { GEMINI_IMAGE_MODEL, createGeminiProvider } from "./gemini";
import { ProviderError } from "./image-provider";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const OUT = Buffer.from([9, 8, 7, 6]).toString("base64");

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const withImage = (key: "inlineData" | "inline_data" = "inlineData") => ({
  candidates: [
    {
      content: {
        parts: [{ text: "Here it is." }, { [key]: { mimeType: "image/png", data: OUT } }],
      },
    },
  ],
});

describe("createGeminiProvider", () => {
  it("sends the prompt and the flat to the model, with the key in a header", async () => {
    const fetcher = vi.fn(async () => answer(withImage()));
    const provider = createGeminiProvider({ apiKey: "secret-key", fetch: fetcher });

    await provider.generate({ prompt: "A tee", reference: PNG });

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    );
    expect(url).not.toContain("secret-key");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("secret-key");
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts).toEqual([
      { text: "A tee" },
      { inline_data: { mime_type: "image/png", data: Buffer.from(PNG).toString("base64") } },
    ]);
    expect(body.generationConfig.responseModalities).toEqual(["TEXT", "IMAGE"]);
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: "1:1" });
  });

  it("returns the picture's bytes", async () => {
    const provider = createGeminiProvider({ apiKey: "k", fetch: async () => answer(withImage()) });

    const image = await provider.generate({ prompt: "p", reference: PNG });

    expect([...image.bytes]).toEqual([9, 8, 7, 6]);
    expect(image.contentType).toBe("image/png");
  });

  it("reads the picture under either spelling of its field", async () => {
    const provider = createGeminiProvider({
      apiKey: "k",
      fetch: async () => answer(withImage("inline_data")),
    });

    expect((await provider.generate({ prompt: "p", reference: PNG })).bytes.length).toBe(4);
  });

  it("fails when the answer holds no picture", async () => {
    const provider = createGeminiProvider({
      apiKey: "k",
      fetch: async () => answer({ candidates: [{ content: { parts: [{ text: "No." }] } }] }),
    });

    await expect(provider.generate({ prompt: "p", reference: PNG })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("says a refused key or account cannot be helped by a retry", async () => {
    for (const status of [401, 403, 429]) {
      const provider = createGeminiProvider({
        apiKey: "k",
        fetch: async () => answer({ error: { message: "nope" } }, status),
      });
      const error = await provider.generate({ prompt: "p", reference: PNG }).catch((e) => e);

      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).refused).toBe(status !== 429);
    }
  });

  it("fails on a server error without echoing the provider's text", async () => {
    const provider = createGeminiProvider({
      apiKey: "k",
      fetch: async () => answer({ error: { message: "internal detail" } }, 500),
    });
    const error = (await provider.generate({ prompt: "p", reference: PNG }).catch((e) => e)) as Error;

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).not.toContain("internal detail");
  });

  it("fails when the network does", async () => {
    const provider = createGeminiProvider({
      apiKey: "k",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(provider.generate({ prompt: "p", reference: PNG })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("refuses a picture larger than the limit", async () => {
    const huge = Buffer.alloc(30 * 1024 * 1024).toString("base64");
    const provider = createGeminiProvider({
      apiKey: "k",
      fetch: async () =>
        answer({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: huge } }] } }] }),
    });

    await expect(provider.generate({ prompt: "p", reference: PNG })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("passes the caller's signal on, so a slow call can be stopped", async () => {
    const fetcher = vi.fn(async () => answer(withImage()));
    const provider = createGeminiProvider({ apiKey: "k", fetch: fetcher });
    const controller = new AbortController();

    await provider.generate({ prompt: "p", reference: PNG }, controller.signal);

    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBe(controller.signal);
  });
});
