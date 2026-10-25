import { describe, expect, it } from "vitest";
import { AI_GENERATED_LABEL } from "./limits";
import { videoPath } from "./paths";
import { sniffVideo } from "./sniff";
import { stubVideoProvider, stubWebm } from "./stub";
import { chooseVideoProvider } from "./select";
import { element, text, uint } from "./webm";

const still = new Uint8Array([1, 2, 3]);

describe("sniffVideo", () => {
  it("knows WebM and MP4 by their first bytes and nothing else", () => {
    expect(sniffVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("video/webm");
    expect(sniffVideo(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]))).toBe("video/mp4");
    expect(sniffVideo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(sniffVideo(new Uint8Array())).toBeNull();
  });
});

describe("webm writer", () => {
  it("writes ids, an eight byte size and the payload", () => {
    expect(element(0x4282, text("webm"))).toEqual([0x42, 0x82, 1, 0, 0, 0, 0, 0, 0, 4, 119, 101, 98, 109]);
    expect(uint(0)).toEqual([0]);
    expect(uint(258)).toEqual([1, 2]);
    expect(element(0x1a45dfa3, []).slice(0, 4)).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });
});

describe("the stub video provider", () => {
  it("makes the same bytes for the same still and different bytes for another", async () => {
    const a = stubWebm(still, 5);
    expect(stubWebm(still, 5)).toEqual(a);
    expect(stubWebm(new Uint8Array([9]), 5)).not.toEqual(a);
    expect(sniffVideo(a)).toBe("video/webm");
  });
  it("says in the file that it is AI generated and not playable", () => {
    const body = new TextDecoder().decode(stubWebm(still, 5));
    expect(body).toContain(AI_GENERATED_LABEL);
    expect(body).toContain("not a playable video");
  });
  it("costs nothing and answers a request", async () => {
    const provider = stubVideoProvider();
    expect(provider.costMicrodollars).toBe(0);
    const result = await provider.generate({ still, seconds: 5, prompt: "p" }, new AbortController().signal);
    expect(result).toMatchObject({ ok: true, type: "video/webm" });
  });
});

describe("chooseVideoProvider", () => {
  it("is the stub unless the key is set AND video is switched on", () => {
    expect(chooseVideoProvider({}).name).toBe("stub-video");
    expect(chooseVideoProvider({ FAL_KEY: "k" }).name).toBe("stub-video");
    expect(chooseVideoProvider({ MEDIA_VIDEO_LIVE: "true" }).name).toBe("stub-video");
    expect(chooseVideoProvider({ FAL_KEY: "k", MEDIA_VIDEO_LIVE: "yes" }).name).toBe("stub-video");
    const fetcher = async () => new Response("{}");
    expect(chooseVideoProvider({ FAL_KEY: "k", MEDIA_VIDEO_LIVE: "true" }, fetcher).name).toMatch(/^fal:/);
    expect(chooseVideoProvider({ FAL_KEY: "k", MEDIA_VIDEO_LIVE: "true" }).name).toMatch(/^fal:/);
  });
});

describe("videoPath", () => {
  it("is inside the brand's private folder and differs by kind and view", () => {
    expect(videoPath("b", "s", "clip", "scene")).toBe("_private/b/s/clip-scene.video");
    expect(videoPath("b", "s", "turntable", "three_quarter")).not.toBe(videoPath("b", "s", "clip", "three_quarter"));
  });
});

describe("CLIP_COST", () => {
  it("reserves the video model's estimate from the photoreal allowance", async () => {
    const { CLIP_COST } = await import("./cost");
    expect(CLIP_COST).toEqual({ feature: "photoreal", microdollars: 250_000 });
  });
});

describe("the sentences", () => {
  it("avoid the words the wording rule forbids", async () => {
    const copy = await import("./copy");
    const forbidden = /\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i;
    for (const [name, value] of Object.entries(copy)) if (name !== "TURN_EVENT") expect(value, name).not.toMatch(forbidden);
  });
});
