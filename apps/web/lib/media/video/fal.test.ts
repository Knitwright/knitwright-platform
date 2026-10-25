import { describe, expect, it, vi } from "vitest";
import { createFalVideoProvider, FAL_VIDEO_MODEL } from "./fal";
import { stubWebm } from "./stub";

/** Recorded shapes of fal's answers; no test here reaches the network. */
const signal = new AbortController().signal;
const request = { still: new Uint8Array([1, 2]), seconds: 5, prompt: "p" };
const video = stubWebm(new Uint8Array([7]), 5);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const provider = (fetcher: (input: string, init: RequestInit) => Promise<Response>) => createFalVideoProvider({ apiKey: "secret-key", fetch: fetcher });

describe("the fal video adapter", () => {
  it("posts the still and fetches the video from fal's file host", async () => {
    const fetcher = vi.fn(async (url: string) => (url.includes("fal.run") ? json({ video: { url: "https://v3.fal.media/files/clip.mp4" } }) : new Response(Buffer.from(video))));
    const result = await provider(fetcher).generate(request, signal);
    expect(result).toMatchObject({ ok: true, type: "video/webm" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://fal.run/${FAL_VIDEO_MODEL}`);
    expect((init.headers as Record<string, string>).authorization).toBe("Key secret-key");
    expect((init.headers as Record<string, string>)["x-fal-store-io"]).toBe("0");
    expect(JSON.parse(String(init.body))).toMatchObject({ prompt: "p", duration: "5" });
    expect(JSON.parse(String(init.body)).image_url).toMatch(/^data:image\/png;base64,/);
  });

  it.each([
    ["a refused request", async () => json({}, 402)],
    ["an answer with no video", async () => json({})],
    ["an answer that is not the expected shape", async () => json({ video: 3 })],
    ["a video outside fal's file host", async () => json({ video: { url: "https://evil.example/clip.mp4" } })],
    ["a network failure", async () => Promise.reject(new Error("down"))],
  ])("gives a plain sentence for %s", async (_name, first) => {
    const result = await provider(first).generate(request, signal);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("Nothing was charged") });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it.each([
    ["a file that cannot be fetched", async () => new Response("no", { status: 500 })],
    ["a file that is not a video", async () => new Response(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))],
    ["a file that says it is far too large", async () => new Response(Buffer.from(video), { headers: { "content-length": String(500 * 1024 * 1024) } })],
  ])("refuses %s", async (_name, second) => {
    const fetcher = async (url: string) => (url.includes("fal.run") ? json({ video: { url: "https://cdn.fal.media/x.mp4" } }) : second());
    expect(await provider(fetcher).generate(request, signal)).toMatchObject({ ok: false });
  });
});
