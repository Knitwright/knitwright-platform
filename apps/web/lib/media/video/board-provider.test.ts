import { describe, expect, it } from "vitest";
import { audioAvailable, chooseBoardVideoProvider, STUB_BOARD_PROVIDER, stubBoardVideoProvider, type BoardVideoRequest } from "./board-provider";
import { FAL_VIDEO_COST_PER_SECOND_MICRODOLLARS, FAL_VIDEO_MODEL } from "./fal";
import { MODEL_CATALOGUE } from "./models";
import { sniffVideo } from "./sniff";

const REQUEST: BoardVideoRequest = {
  firstFrame: new Uint8Array([1, 2, 3, 4]),
  endFrame: new Uint8Array([5, 6, 7, 8]),
  prompt: "slow orbit",
  seconds: 6,
  aspect: "1:1",
  audio: true,
  modelKey: "kling-2.1-standard",
};

const signal = () => new AbortController().signal;

const answer = (body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });

describe("the stub provider", () => {
  it("is what a studio with no video key gets, and it costs nothing", () => {
    expect(chooseBoardVideoProvider({}).name).toBe(STUB_BOARD_PROVIDER);
    expect(chooseBoardVideoProvider({ FAL_KEY: "k" }).name).toBe(STUB_BOARD_PROVIDER);
    expect(chooseBoardVideoProvider({ MEDIA_VIDEO_LIVE: "true" }).name).toBe(STUB_BOARD_PROVIDER);
    expect(chooseBoardVideoProvider({ FAL_KEY: "k", MEDIA_VIDEO_LIVE: "yes" }).name).toBe(STUB_BOARD_PROVIDER);
    expect(stubBoardVideoProvider().costPerSecondMicrodollars).toBe(0);
  });

  it("gives back the same bytes for the same first frame, and they are a WebM", async () => {
    const made = await stubBoardVideoProvider().generate(REQUEST, signal());
    const again = await stubBoardVideoProvider().generate(REQUEST, signal());
    expect(made.ok && again.ok).toBe(true);
    if (!made.ok || !again.ok) return;
    expect(made.video).toEqual(again.video);
    expect(sniffVideo(made.video)).toBe("video/webm");
    expect(made.type).toBe("video/webm");
  });

  it("says in the file itself that it was made by a machine", async () => {
    const made = await stubBoardVideoProvider().generate(REQUEST, signal());
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(Buffer.from(made.video).toString("latin1")).toContain("AI generated");
  });

  it("takes the paid adapter only when a key is set and the owner has turned video on", () => {
    expect(chooseBoardVideoProvider({ FAL_KEY: "k", MEDIA_VIDEO_LIVE: "true" }).name).toBe(`fal:${FAL_VIDEO_MODEL}`);
  });

  it("says whether the Audio switch does anything for a model", () => {
    const quiet = MODEL_CATALOGUE.find((model) => !model.audio);
    const loud = MODEL_CATALOGUE.find((model) => model.audio);
    expect(loud && audioAvailable(loud)).toBe(true);
    expect(quiet && audioAvailable(quiet)).toBe(false);
  });
});

describe("the paid adapter, against a fake fetch", () => {
  const video = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);

  const provider = (fetcher: (input: string, init: RequestInit) => Promise<Response>) =>
    chooseBoardVideoProvider({ FAL_KEY: "key-1", MEDIA_VIDEO_LIVE: "true" }, fetcher);

  it("sends the prompt, both frames, the length and the aspect, and never a stored file", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const made = await provider(async (url, init) => {
      seen.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
      return url.startsWith("https://fal.run")
        ? answer({ video: { url: "https://v3.fal.media/files/clip.mp4" } })
        : new Response(video, { status: 200, headers: { "content-length": String(video.byteLength) } });
    }).generate(REQUEST, signal());

    expect(made.ok).toBe(true);
    const body = seen[0]?.body as Record<string, unknown>;
    expect(body["prompt"]).toBe("slow orbit");
    expect(String(body["image_url"]).startsWith("data:image/png;base64,")).toBe(true);
    expect(String(body["tail_image_url"]).startsWith("data:image/png;base64,")).toBe(true);
    expect(body["duration"]).toBe("6");
    expect(body["aspect_ratio"]).toBe("1:1");
  });

  it("leaves the end frame out when there is none", async () => {
    const seen: unknown[] = [];
    await provider(async (url, init) => {
      seen.push(init.body ? JSON.parse(String(init.body)) : null);
      return url.startsWith("https://fal.run") ? answer({ video: { url: "https://v3.fal.media/files/clip.mp4" } }) : new Response(video, { status: 200 });
    }).generate({ ...REQUEST, endFrame: undefined }, signal());
    expect(Object.keys(seen[0] as object)).not.toContain("tail_image_url");
  });

  it("refuses a file address that is not on the model host's own file server", async () => {
    const made = await provider(async () => answer({ video: { url: "https://example.test/clip.mp4" } })).generate(REQUEST, signal());
    expect(made).toMatchObject({ ok: false });
  });

  it("refuses an answer with no video in it, and a call that failed", async () => {
    expect(await provider(async () => answer({})).generate(REQUEST, signal())).toMatchObject({ ok: false });
    expect(await provider(async () => new Response("no", { status: 500 })).generate(REQUEST, signal())).toMatchObject({ ok: false });
  });

  it("refuses a file whose first bytes are not a video", async () => {
    const made = await provider(async (url) =>
      url.startsWith("https://fal.run") ? answer({ video: { url: "https://v3.fal.media/files/clip.mp4" } }) : new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    ).generate(REQUEST, signal());
    expect(made).toMatchObject({ ok: false });
  });

  it("prices itself by the second, from the clip's own labelled estimate", () => {
    expect(FAL_VIDEO_COST_PER_SECOND_MICRODOLLARS).toBe(50_000);
    expect(provider(async () => answer({})).costPerSecondMicrodollars).toBe(FAL_VIDEO_COST_PER_SECOND_MICRODOLLARS);
  });
});
