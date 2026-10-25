import { describe, expect, it, vi } from "vitest";
import type { MediaKind, MediaView } from "../contract";
import { cleanPath } from "../paths";
import { memoryFiles, memoryStore } from "../test-deps";
import { attachItem, BUSY_MESSAGE } from "./attach";
import { CLIP_FAILED_MESSAGE, makeClip, NEEDS_STILL_MESSAGE, planClip, type ClipDeps } from "./clip";
import { MAX_CLIP_BYTES, MAX_TURNTABLE_BYTES } from "./limits";
import { videoPath } from "./paths";
import { NOT_A_VIDEO_MESSAGE, NO_POSTER_MESSAGE, TOO_LARGE_MESSAGE } from "./recording";
import { CLIP_LOCKED_MESSAGE, serveVideo } from "./serve";
import { stubVideoProvider } from "./stub";
import { memoryVideos, png, webm } from "./test-deps";
import { SET_NOT_FINISHED, saveTurntable } from "./turntable";
import { videoItems } from "./view";
import type { VideoProvider } from "./provider";

const BRAND = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";
const signal = new AbortController().signal;

/** A WebM signature followed by zeros, one byte over the cap. */
const oversized = (cap: number): Uint8Array => {
  const bytes = new Uint8Array(cap + 1);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return bytes;
};

type StillSpec = { view: MediaView; checker: "passed" | "rejected" };

/** A finished set, optionally with lifestyle stills (their clean pictures are kept as the generator would). */
async function finishedSet(stills: StillSpec[] = []) {
  const store = memoryStore();
  const files = memoryFiles();
  const videos = memoryVideos();
  const { id } = await store.start({ brandId: BRAND, projectId: PROJECT, userId: USER, version: 1, versionHash: "h" });
  await store.move(id, ["queued"], "running");
  for (const spec of stills) {
    const path = cleanPath(BRAND, id, "lifestyle", spec.view);
    await files.saveClean(path, await png("#cc3333", 80, 60));
    await store.putItem(id, { kind: "lifestyle" as MediaKind, view: spec.view, fileId: await files.saveWatermarked(await png()), cleanPath: path, width: 80, height: 60, checker: spec.checker, provider: "t", costMicrodollars: 0 });
  }
  await store.move(id, ["running"], "succeeded");
  return { store, files, videos, setId: id };
}

describe("attachItem", () => {
  it("adds an item to a finished set and leaves it finished, with both moves in the history", async () => {
    const t = await finishedSet();
    await attachItem(t.store, t.setId, { kind: "turntable", view: "three_quarter", fileId: null, cleanPath: null, width: 1, height: 1, checker: "not_checked", provider: "x", costMicrodollars: 0 });
    expect(t.store.sets.get(t.setId)?.status).toBe("succeeded");
    expect(t.store.history.slice(-2)).toEqual(["running", "succeeded"]);
  });
  it("restores the state when the write fails, and refuses a set that is not finished", async () => {
    const t = await finishedSet();
    t.store.putItem = async () => {
      throw new Error("db");
    };
    await expect(attachItem(t.store, t.setId, { kind: "clip", view: "scene", fileId: null, cleanPath: null, width: 1, height: 1, checker: "not_checked", provider: "x", costMicrodollars: 0 })).rejects.toThrow("db");
    expect(t.store.sets.get(t.setId)?.status).toBe("succeeded");
    await t.store.move(t.setId, ["succeeded"], "failed", "x");
    await expect(attachItem(t.store, t.setId, { kind: "clip", view: "scene", fileId: null, cleanPath: null, width: 1, height: 1, checker: "not_checked", provider: "x", costMicrodollars: 0 })).rejects.toThrow(BUSY_MESSAGE);
  });
});

describe("saving a turntable", () => {
  const ask = async (t: Awaited<ReturnType<typeof finishedSet>>, over: Partial<{ video: Uint8Array; poster: Uint8Array; brandId: string; setId: string }> = {}) => ({
    brandId: BRAND, projectId: PROJECT, setId: t.setId, video: webm(), poster: await png(), ...over,
  });

  it("keeps the video privately, the poster watermarked, and records a free turntable item", async () => {
    const t = await finishedSet();
    const { itemId } = await saveTurntable(t, await ask(t));
    const item = t.store.sets.get(t.setId)?.items.find((entry) => entry.id === itemId);
    expect(item).toMatchObject({ kind: "turntable", view: "three_quarter", provider: "browser-recorder", costMicrodollars: 0, checker: "not_checked", width: 64, height: 48 });
    expect(t.videos.saved.has(videoPath(BRAND, t.setId, "turntable", "three_quarter"))).toBe(true);
    expect(t.files.watermarked.size).toBe(1);
    expect(t.files.clean.has(cleanPath(BRAND, t.setId, "turntable", "three_quarter"))).toBe(true);
  });

  it("replaces the first recording with the second", async () => {
    const t = await finishedSet();
    await saveTurntable(t, await ask(t));
    await saveTurntable(t, await ask(t, { video: webm("second") }));
    expect(t.store.sets.get(t.setId)?.items.filter((entry) => entry.kind === "turntable")).toHaveLength(1);
    expect(t.videos.saved.get(videoPath(BRAND, t.setId, "turntable", "three_quarter"))).toEqual(webm("second"));
  });

  it.each([
    ["a file that is not a video", { video: new Uint8Array([1, 2, 3, 4, 5, 6]) }, NOT_A_VIDEO_MESSAGE],
    ["a recording over the size cap", { video: oversized(MAX_TURNTABLE_BYTES) }, TOO_LARGE_MESSAGE],
    ["a missing poster", { poster: new Uint8Array() }, NO_POSTER_MESSAGE],
    ["a poster that is not a picture", { poster: new Uint8Array([1, 2, 3]) }, NO_POSTER_MESSAGE],
  ])("refuses %s and stores nothing", async (_name, over, message) => {
    const t = await finishedSet();
    await expect(saveTurntable(t, await ask(t, over))).rejects.toMatchObject({ message });
    expect(t.videos.saved.size).toBe(0);
    expect(t.files.watermarked.size).toBe(0);
  });

  it("refuses a poster larger than the side cap", async () => {
    const t = await finishedSet();
    await expect(saveTurntable(t, await ask(t, { poster: await png("#fff", 5000, 8) }))).rejects.toMatchObject({ message: NO_POSTER_MESSAGE });
  });

  it("refuses a set of another brand, a missing set and one that is not finished", async () => {
    const t = await finishedSet();
    await expect(saveTurntable(t, await ask(t, { brandId: OTHER }))).rejects.toMatchObject({ code: "not_found" });
    await expect(saveTurntable(t, await ask(t, { setId: "55555555-5555-4555-8555-555555555555" }))).rejects.toMatchObject({ code: "not_found" });
    await t.store.move(t.setId, ["succeeded"], "running");
    await expect(saveTurntable(t, await ask(t))).rejects.toMatchObject({ message: SET_NOT_FINISHED });
  });

  it("removes what it stored when the item cannot be recorded", async () => {
    const t = await finishedSet();
    t.store.putItem = async () => {
      throw new Error("db");
    };
    await expect(saveTurntable(t, await ask(t))).rejects.toThrow("db");
    expect(t.videos.saved.size).toBe(0);
    expect(t.files.watermarked.size).toBe(0);
    expect(t.files.clean.size).toBe(0);
    expect(t.store.sets.get(t.setId)?.status).toBe("succeeded");
  });
});

const clipDeps = (t: Awaited<ReturnType<typeof finishedSet>>, provider: VideoProvider = stubVideoProvider()): ClipDeps => ({ store: t.store, files: t.files, videos: t.videos, provider, log: vi.fn() });
const clipAsk = (t: Awaited<ReturnType<typeof finishedSet>>, view?: MediaView) => ({ brandId: BRAND, projectId: PROJECT, setId: t.setId, view });

describe("planning a clip", () => {
  it("needs a lifestyle still that passed the check", async () => {
    const none = await finishedSet();
    await expect(planClip(none.store, clipAsk(none))).rejects.toMatchObject({ message: NEEDS_STILL_MESSAGE });
    const rejected = await finishedSet([{ view: "scene", checker: "rejected" }]);
    await expect(planClip(rejected.store, clipAsk(rejected))).rejects.toMatchObject({ message: NEEDS_STILL_MESSAGE });
  });
  it("picks the asked view, or the first passed still", async () => {
    const t = await finishedSet([{ view: "on_model", checker: "passed" }, { view: "scene", checker: "passed" }]);
    expect(await planClip(t.store, clipAsk(t, "scene"))).toMatchObject({ state: "ready", still: { view: "scene" } });
    expect((await planClip(t.store, clipAsk(t))).state).toBe("ready");
    const only = await finishedSet([{ view: "scene", checker: "passed" }]);
    await expect(planClip(only.store, clipAsk(only, "on_model"))).rejects.toMatchObject({ message: NEEDS_STILL_MESSAGE });
  });
  it("refuses a missing, foreign or unfinished set", async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    await expect(planClip(t.store, { ...clipAsk(t), brandId: OTHER })).rejects.toMatchObject({ code: "not_found" });
    await t.store.move(t.setId, ["succeeded"], "running");
    await expect(planClip(t.store, clipAsk(t))).rejects.toMatchObject({ code: "conflict" });
  });
  it("says the clip exists once it is made, so nothing is paid twice", async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const plan = await planClip(t.store, clipAsk(t));
    if (plan.state !== "ready") throw new Error("expected ready");
    await makeClip(clipDeps(t), clipAsk(t), plan, signal);
    expect((await planClip(t.store, clipAsk(t))).state).toBe("exists");
  });
});

describe("making a clip", () => {
  const ready = async (t: Awaited<ReturnType<typeof finishedSet>>) => {
    const plan = await planClip(t.store, clipAsk(t));
    if (plan.state !== "ready") throw new Error("expected ready");
    return plan;
  };

  it("keeps the clip privately with the still as its poster and records the provider's cost", async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const provider: VideoProvider = { ...stubVideoProvider(), name: "paid-test", costMicrodollars: 250_000 };
    const done = await makeClip(clipDeps(t, provider), clipAsk(t), await ready(t), signal);
    expect(done.ok).toBe(true);
    const item = t.store.sets.get(t.setId)?.items.find((entry) => entry.kind === "clip");
    expect(item).toMatchObject({ view: "scene", provider: "paid-test", costMicrodollars: 250_000, checker: "not_checked" });
    expect(t.videos.saved.has(videoPath(BRAND, t.setId, "clip", "scene"))).toBe(true);
    expect(t.store.sets.get(t.setId)?.status).toBe("succeeded");
  });

  it("sends the provider the still, five seconds and the fixed prompt", async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const generate = vi.fn(stubVideoProvider().generate);
    await makeClip(clipDeps(t, { ...stubVideoProvider(), generate }), clipAsk(t), await ready(t), signal);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ seconds: 5, prompt: expect.stringContaining("crest") });
  });

  const failing: Array<[string, VideoProvider]> = [
    ["a refusal", { ...stubVideoProvider(), generate: async () => ({ ok: false, message: "raw provider text" }) }],
    ["a file that is not the type it says", { ...stubVideoProvider(), generate: async () => ({ ok: true, video: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), type: "video/webm" }) }],
    ["a file over the size cap", { ...stubVideoProvider(), generate: async () => ({ ok: true, video: oversized(MAX_CLIP_BYTES), type: "video/webm" }) }],
  ];
  it.each(failing)("answers a sentence and stores nothing on %s", async (_name, provider) => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const done = await makeClip(clipDeps(t, provider), clipAsk(t), await ready(t), signal);
    expect(done).toEqual({ ok: false, message: CLIP_FAILED_MESSAGE });
    expect(t.videos.saved.size).toBe(0);
    expect(t.store.sets.get(t.setId)?.items.some((entry) => entry.kind === "clip")).toBe(false);
  });

  it("answers a sentence and cleans up when storing throws", async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const deps = clipDeps(t);
    t.videos.save = async () => {
      throw new Error("storage");
    };
    const done = await makeClip(deps, clipAsk(t), await ready(t), signal);
    expect(done).toEqual({ ok: false, message: CLIP_FAILED_MESSAGE });
    expect(deps.log).toHaveBeenCalled();
    expect(t.files.watermarked.size).toBe(1); // the still's own watermarked picture only
  });

  it("answers a sentence when the still's clean picture is gone", async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const plan = await ready(t);
    t.files.clean.clear();
    expect(await makeClip(clipDeps(t), clipAsk(t), plan, signal)).toEqual({ ok: false, message: CLIP_FAILED_MESSAGE });
  });
});

describe("serving a video (the gate)", () => {
  const made = async () => {
    const t = await finishedSet([{ view: "scene", checker: "passed" }]);
    const plan = await planClip(t.store, clipAsk(t));
    if (plan.state !== "ready") throw new Error("expected ready");
    await makeClip(clipDeps(t), clipAsk(t), plan, signal);
    await saveTurntable(t, { brandId: BRAND, projectId: PROJECT, setId: t.setId, video: webm(), poster: await png() });
    const items = t.store.sets.get(t.setId)?.items ?? [];
    return { ...t, clip: items.find((i) => i.kind === "clip")!.id, turntable: items.find((i) => i.kind === "turntable")!.id };
  };
  const ask = (t: { setId: string }, itemId: string, brandId = BRAND) => ({ brandId, projectId: PROJECT, setId: t.setId, itemId });

  it("does not read the clip file from storage before credits are spent, and says it is locked", async () => {
    const t = await made();
    t.videos.reads.length = 0;
    const answer = await serveVideo(t, ask(t, t.clip));
    expect(answer).toEqual({ state: "locked" });
    expect(t.videos.reads).toEqual([]);
    expect(CLIP_LOCKED_MESSAGE).toMatch(/credits/);
  });

  it("serves the clip after the unlock, labelled AI generated, and not while the set is mid-write", async () => {
    const t = await made();
    await t.store.unlock(t.setId, USER);
    const answer = await serveVideo(t, ask(t, t.clip));
    expect(answer).toMatchObject({ state: "ok", contentType: "video/webm", aiGenerated: true });
    await t.store.move(t.setId, ["succeeded"], "running");
    expect(await serveVideo(t, ask(t, t.clip))).toEqual({ state: "locked" });
  });

  it("serves the free turntable without an unlock", async () => {
    const t = await made();
    expect(await serveVideo(t, ask(t, t.turntable))).toMatchObject({ state: "ok", aiGenerated: false });
  });

  it("never serves another brand's video, a picture item, a missing item or unreadable bytes", async () => {
    const t = await made();
    await t.store.unlock(t.setId, USER);
    expect(await serveVideo(t, ask(t, t.clip, OTHER))).toEqual({ state: "missing" });
    const still = t.store.sets.get(t.setId)?.items.find((item) => item.kind === "lifestyle");
    expect(await serveVideo(t, ask(t, still?.id ?? ""))).toEqual({ state: "missing" });
    expect(await serveVideo(t, ask(t, "66666666-6666-4666-8666-666666666666"))).toEqual({ state: "missing" });
    t.videos.saved.set(videoPath(BRAND, t.setId, "clip", "scene"), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(await serveVideo(t, ask(t, t.clip))).toEqual({ state: "missing" });
    t.videos.saved.clear();
    expect(await serveVideo(t, ask(t, t.clip))).toEqual({ state: "missing" });
  });

  it("gives the browser no address for a locked clip and one for everything else", async () => {
    const t = await made();
    const set = t.store.sets.get(t.setId)!;
    const locked = videoItems(set);
    expect(locked.find((item) => item.kind === "clip")).toMatchObject({ locked: true, videoHref: null, aiGenerated: true });
    expect(locked.find((item) => item.kind === "turntable")?.videoHref).toMatch(/\/items\/.+\/video$/);
    expect(JSON.stringify(locked)).not.toContain("_private");
    await t.store.unlock(t.setId, USER);
    expect(videoItems(t.store.sets.get(t.setId)!).every((item) => !item.locked && item.videoHref)).toBe(true);
  });
});
