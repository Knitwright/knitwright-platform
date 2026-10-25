import { describe, expect, it, vi } from "vitest";
import { cleanPath } from "../paths";
import { memoryFiles, memoryStore } from "../test-deps";
import { startClip, type StartClipDeps } from "./start-clip";
import { stubVideoProvider } from "./stub";
import { memoryVideos, png } from "./test-deps";

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";

async function setup(provider = stubVideoProvider()) {
  const store = memoryStore();
  const files = memoryFiles();
  const { id } = await store.start({ brandId: BRAND, projectId: PROJECT, userId: USER, version: 1, versionHash: "h" });
  await store.move(id, ["queued"], "running");
  const path = cleanPath(BRAND, id, "lifestyle", "scene");
  await files.saveClean(path, await png());
  await store.putItem(id, { kind: "lifestyle", view: "scene", fileId: null, cleanPath: path, width: 64, height: 48, checker: "passed", provider: "t", costMicrodollars: 0 });
  await store.move(id, ["running"], "succeeded");
  const scheduled: Array<() => Promise<unknown>> = [];
  const refund = vi.fn(async () => {});
  const deps: StartClipDeps = { store, files, videos: memoryVideos(), provider, log: vi.fn(), schedule: (work) => void scheduled.push(work), refund };
  return { deps, scheduled, refund, ask: { brandId: BRAND, projectId: PROJECT, setId: id }, store, id };
}

describe("startClip", () => {
  it("schedules the paid call after the response and keeps the reservation when it works", async () => {
    const t = await setup();
    expect(await startClip(t.deps, t.ask)).toEqual({ state: "started" });
    expect(t.store.sets.get(t.id)?.items.some((item) => item.kind === "clip")).toBe(false);
    await t.scheduled[0]?.();
    expect(t.store.sets.get(t.id)?.items.some((item) => item.kind === "clip")).toBe(true);
    expect(t.refund).not.toHaveBeenCalled();
  });
  it("gives the reservation back when the provider fails", async () => {
    const t = await setup({ ...stubVideoProvider(), generate: async () => ({ ok: false, message: "x" }) });
    await startClip(t.deps, t.ask);
    await t.scheduled[0]?.();
    expect(t.refund).toHaveBeenCalledTimes(1);
  });
  it("calls no provider and gives the reservation back when the clip exists", async () => {
    const t = await setup();
    await startClip(t.deps, t.ask);
    await t.scheduled.shift()?.();
    const generate = vi.fn(t.deps.provider.generate);
    expect(await startClip({ ...t.deps, provider: { ...t.deps.provider, generate } }, t.ask)).toEqual({ state: "exists" });
    expect(generate).not.toHaveBeenCalled();
    expect(t.refund).toHaveBeenCalledTimes(1);
    expect(t.scheduled).toHaveLength(0);
  });
  it("refuses before scheduling when there is no passed still", async () => {
    const t = await setup();
    await t.store.move(t.id, ["succeeded"], "running");
    await expect(startClip(t.deps, t.ask)).rejects.toMatchObject({ code: "conflict" });
    expect(t.scheduled).toHaveLength(0);
  });
});
