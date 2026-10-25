import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { GeneratorResult, MediaGenerator } from "./contract";
import { mediaItemSchema, mediaSetSchema } from "./contract";
import { FAILED_MESSAGE, runMediaSet } from "./generate";
import { CLEAN_FOLDER } from "./paths";
import { serveItem } from "./serve";
import { NO_DRAWING_MESSAGE, startMediaSet } from "./start";
import { memoryFiles, memoryStore } from "./test-deps";
import { NOT_FINISHED_MESSAGE, unlockSet } from "./unlock";
import { setView } from "./view";
import { mediaVersionHash } from "./version";

const BRAND = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";

const solid = async (colour: string): Promise<Uint8Array> =>
  new Uint8Array(await sharp({ create: { width: 200, height: 160, channels: 3, background: colour } }).png().toBuffer());

const generator = (result: () => Promise<GeneratorResult>): MediaGenerator => ({ name: "test", generate: result });

const okGenerator = (): MediaGenerator =>
  generator(async () => ({
    ok: true,
    media: [
      { kind: "studio_render", view: "front", png: await solid("#cc3333"), width: 200, height: 160, checker: "not_checked", provider: "test", costMicrodollars: 0 },
      { kind: "studio_render", view: "back", png: await solid("#33cc33"), width: 200, height: 160, checker: "not_checked", provider: "test", costMicrodollars: 0 },
    ],
  }));

const setup = (generators: MediaGenerator[] = [okGenerator()]) => {
  const store = memoryStore();
  const files = memoryFiles();
  const log = vi.fn();
  const scheduled: Array<() => Promise<unknown>> = [];
  const start = (version = 1) =>
    startMediaSet(
      {
        store,
        loadVersion: async () => ({ version }),
        schedule: (work) => void scheduled.push(work),
        run: (work) => runMediaSet({ store, files, generators, log }, { ...work, brandId: BRAND }),
      },
      { brandId: BRAND, projectId: PROJECT, userId: USER },
    );
  const drain = async () => {
    while (scheduled.length) await scheduled.shift()?.();
  };
  return { store, files, log, start, drain };
};

describe("starting a set", () => {
  it("queues a set and runs it after the response", async () => {
    const t = setup();
    const { set, created } = await t.start();
    expect(created).toBe(true);
    expect(set.status).toBe("queued");
    expect(set.versionHash).toBe(mediaVersionHash(PROJECT, 1));
    await t.drain();
    expect((await t.store.read(BRAND, PROJECT, set.id))?.status).toBe("succeeded");
    expect(t.store.history).toEqual(["queued", "running", "succeeded"]);
  });

  it("returns the existing set for the same version and starts no second job", async () => {
    const t = setup();
    const first = await t.start();
    await t.drain();
    const again = await t.start();
    expect(again.created).toBe(false);
    expect(again.set.id).toBe(first.set.id);
    await t.drain();
    expect(t.store.sets.size).toBe(1);
    expect(t.files.watermarked.size).toBe(2);
  });

  it("makes a new set for a new version", async () => {
    const t = setup();
    const one = await t.start(1);
    const two = await t.start(2);
    expect(two.set.id).not.toBe(one.set.id);
  });

  it("refuses when the design has no drawing, and makes no set", async () => {
    const store = memoryStore();
    await expect(
      startMediaSet({ store, loadVersion: async () => null, schedule: () => {}, run: async () => {} }, { brandId: BRAND, projectId: PROJECT, userId: USER }),
    ).rejects.toThrow(NO_DRAWING_MESSAGE);
    expect(store.sets.size).toBe(0);
  });

  it("starts a failed set again", async () => {
    let fail = true;
    const t = setup([generator(async () => (fail ? { ok: false, message: "No drawing." } : okGenerator().generate({ design: { projectId: PROJECT, version: 1 } }, new AbortController().signal)))]);
    const first = await t.start();
    await t.drain();
    expect((await t.store.read(BRAND, PROJECT, first.set.id))?.status).toBe("failed");
    fail = false;
    const again = await t.start();
    expect(again.created).toBe(true);
    expect(again.set.id).toBe(first.set.id);
    await t.drain();
    expect((await t.store.read(BRAND, PROJECT, first.set.id))?.status).toBe("succeeded");
  });
});

describe("making a set", () => {
  it("stores a watermarked picture and a private clean one for each item", async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const done = await t.store.read(BRAND, PROJECT, set.id);
    expect(done?.items).toHaveLength(2);
    for (const item of done?.items ?? []) {
      expect(item.cleanPath?.startsWith(`${CLEAN_FOLDER}/${BRAND}/`)).toBe(true);
      expect(item.cleanPath).not.toMatch(new RegExp(`^${BRAND}`));
      const marked = t.files.watermarked.get(item.fileId ?? "");
      const clean = t.files.clean.get(item.cleanPath ?? "");
      expect(marked && clean && Buffer.from(marked).equals(Buffer.from(clean))).toBe(false);
    }
  });

  it("marks the set failed with a sentence, and removes what it stored, when a generator throws midway", async () => {
    let calls = 0;
    const t = setup([
      okGenerator(),
      generator(async () => {
        calls += 1;
        throw new Error("provider said: secret detail");
      }),
    ]);
    const { set } = await t.start();
    await t.drain();
    const done = await t.store.read(BRAND, PROJECT, set.id);
    expect(calls).toBe(1);
    expect(done?.status).toBe("failed");
    expect(done?.error).toBe(FAILED_MESSAGE);
    expect(done?.error).not.toContain("secret");
    expect(t.files.watermarked.size).toBe(0);
    expect(t.files.clean.size).toBe(0);
    expect(t.log).toHaveBeenCalled();
  });

  it("uses a generator's own sentence when it refuses", async () => {
    const t = setup([generator(async () => ({ ok: false, message: "Refused in words." }))]);
    const { set } = await t.start();
    await t.drain();
    expect((await t.store.read(BRAND, PROJECT, set.id))?.error).toBe("Refused in words.");
  });

  it("does not run a set that is no longer queued", async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const outcome = await runMediaSet({ store: t.store, files: t.files, generators: [okGenerator()], log: t.log }, { setId: set.id, brandId: BRAND, request: { design: { projectId: PROJECT, version: 1 } } });
    expect(outcome).toBe("failed");
    expect((await t.store.read(BRAND, PROJECT, set.id))?.status).toBe("succeeded");
  });

  it("survives a failure to clean up and a failure to mark failed", async () => {
    const t = setup([generator(async () => { throw new Error("boom"); })]);
    t.files.remove = async () => { throw new Error("cannot remove"); };
    t.store.move = async (_id, from, to) => { if (to === "failed") throw new Error("cannot mark"); return from.length > 0; };
    const { set } = await t.start();
    await t.drain();
    expect(set.id).toBeTruthy();
    expect(t.log.mock.calls.filter(([event]) => event.level === "error").length).toBeGreaterThanOrEqual(3);
  });
});

describe("serving a picture", () => {
  const finished = async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const done = await t.store.read(BRAND, PROJECT, set.id);
    const item = done?.items[0];
    if (!done || !item) throw new Error("no item");
    return { t, set: done, item };
  };

  it("never reads the clean file, or returns its bytes, before the spend", async () => {
    const { t, set, item } = await finished();
    const served = await serveItem(t, { brandId: BRAND, projectId: PROJECT, setId: set.id, itemId: item.id });
    expect(served?.watermarked).toBe(true);
    expect(t.files.cleanReads).toEqual([]);
    const clean = t.files.clean.get(item.cleanPath ?? "") ?? new Uint8Array();
    expect(Buffer.from(served?.bytes ?? []).equals(Buffer.from(clean))).toBe(false);
  });

  it("serves the clean bytes once the set is unlocked", async () => {
    const { t, set, item } = await finished();
    await unlockSet(t.store, { brandId: BRAND, projectId: PROJECT, setId: set.id, userId: USER });
    const served = await serveItem(t, { brandId: BRAND, projectId: PROJECT, setId: set.id, itemId: item.id });
    expect(served?.watermarked).toBe(false);
    expect(Buffer.from(served?.bytes ?? []).equals(Buffer.from(t.files.clean.get(item.cleanPath ?? "") ?? []))).toBe(true);
  });

  it("answers nothing for another brand, another design, or an unknown item", async () => {
    const { t, set, item } = await finished();
    expect(await serveItem(t, { brandId: OTHER, projectId: PROJECT, setId: set.id, itemId: item.id })).toBeNull();
    expect(await serveItem(t, { brandId: BRAND, projectId: OTHER, setId: set.id, itemId: item.id })).toBeNull();
    expect(await serveItem(t, { brandId: BRAND, projectId: PROJECT, setId: set.id, itemId: OTHER })).toBeNull();
    expect(t.files.cleanReads).toEqual([]);
  });

  it("answers nothing when a file is missing", async () => {
    const { t, set, item } = await finished();
    t.files.watermarked.clear();
    expect(await serveItem(t, { brandId: BRAND, projectId: PROJECT, setId: set.id, itemId: item.id })).toBeNull();
    await unlockSet(t.store, { brandId: BRAND, projectId: PROJECT, setId: set.id, userId: USER });
    t.files.clean.clear();
    expect(await serveItem(t, { brandId: BRAND, projectId: PROJECT, setId: set.id, itemId: item.id })).toBeNull();
  });
});

describe("odd moments", () => {
  it("fails the set when it cannot be marked finished", async () => {
    const t = setup();
    const move = t.store.move.bind(t.store);
    t.store.move = async (id, from, to, error) => (to === "succeeded" ? false : move(id, from, to, error));
    const { set } = await t.start();
    await t.drain();
    expect((await t.store.read(BRAND, PROJECT, set.id))?.error).toBe(FAILED_MESSAGE);
  });

  it("says so when the set cannot be read back after it was started", async () => {
    const store = memoryStore();
    store.read = async () => null;
    await expect(
      startMediaSet({ store, loadVersion: async () => ({ version: 1 }), schedule: () => {}, run: async () => {} }, { brandId: BRAND, projectId: PROJECT, userId: USER }),
    ).rejects.toThrow(/could not be found/);
  });

  it("serves nothing for an item with no picture", async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const done = await t.store.read(BRAND, PROJECT, set.id);
    const item = done?.items[0];
    if (!done || !item) throw new Error("no item");
    t.store.sets.set(set.id, { ...done, items: [{ ...item, fileId: null, cleanPath: null }] });
    expect(await serveItem(t, { brandId: BRAND, projectId: PROJECT, setId: set.id, itemId: item.id })).toBeNull();
  });
});

describe("unlocking", () => {
  it("unlocks once and a second call changes nothing", async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const ask = { brandId: BRAND, projectId: PROJECT, setId: set.id, userId: USER };
    expect(await unlockSet(t.store, ask)).toEqual({ unlocked: true, changed: true });
    expect(await unlockSet(t.store, ask)).toEqual({ unlocked: true, changed: false });
    expect(t.store.history.filter((entry) => entry === "unlocked")).toHaveLength(1);
  });

  it("refuses a set that is not finished or not found", async () => {
    const t = setup();
    const { set } = await t.start();
    const ask = { brandId: BRAND, projectId: PROJECT, setId: set.id, userId: USER };
    await expect(unlockSet(t.store, ask)).rejects.toThrow(NOT_FINISHED_MESSAGE);
    await expect(unlockSet(t.store, { ...ask, brandId: OTHER })).rejects.toThrow(/could not be found/);
  });
});

describe("what the browser sees", () => {
  it("lists items as watermarked until unlocked, with an address and no clean path", async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const before = setView((await t.store.read(BRAND, PROJECT, set.id))!);
    expect(before.items.every((item) => item.watermarked && item.href?.startsWith(`/api/projects/${PROJECT}/media/${set.id}/items/`))).toBe(true);
    expect(JSON.stringify(before)).not.toContain(CLEAN_FOLDER);
    await unlockSet(t.store, { brandId: BRAND, projectId: PROJECT, setId: set.id, userId: USER });
    const after = setView((await t.store.read(BRAND, PROJECT, set.id))!);
    expect(after.unlocked).toBe(true);
    expect(after.items.every((item) => !item.watermarked)).toBe(true);
  });

  it("matches the contract", async () => {
    const t = setup();
    const { set } = await t.start();
    await t.drain();
    const view = setView((await t.store.read(BRAND, PROJECT, set.id))!);
    const plain = view.items.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "href")));
    const { unlocked, items, ...rest } = Object.fromEntries(Object.entries(view)) as Record<string, unknown>;
    expect([unlocked, items]).toBeDefined();
    expect(() => plain.forEach((item) => mediaItemSchema.parse(item))).not.toThrow();
    expect(() => mediaSetSchema.parse({ ...rest, items: plain })).not.toThrow();
    expect(setView({ ...(t.store.sets.get(set.id)!), items: [{ ...(t.store.sets.get(set.id)!.items[0]!), fileId: null }] }).items[0]?.href).toBeNull();
  });
});
