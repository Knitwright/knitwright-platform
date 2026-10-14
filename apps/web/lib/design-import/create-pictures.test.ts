import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createFakePieceMapper } from "@/lib/artwork-stack";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import { createBudget } from "./budget";
import { createFromFile, refitImport, type CreateDeps } from "./create";
import { derivedIds } from "./derived";
import { fakeDb } from "./fixtures/fake-db";
import { fakeStore } from "./fixtures/fake-store";
import { renderSheet, SHEET_REPLY, type KnownPattern } from "./fixtures/known";
import { MARKS_REPLY, asText } from "./fixtures/replies";
import { renderTee, TEE_OUTLINE } from "./fixtures/synthetic";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { createMatchBudget } from "./match/budget";
import { createPatternStage } from "./match/stage";

// These run the real pattern matching on whole pictures, which is slower under coverage.
vi.setConfig({ testTimeout: 60_000 });

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const fileId = "55555555-5555-4555-8555-555555555555";
const DOTS: KnownPattern = { generatorId: "kit-dots", params: { dotWidthMm: 20, pitchMm: 45, rowStepMm: 22.5, halfDrop: true }, colours: ["#ffffff"], ground: "#c8102e" };

async function setup(bytes: Uint8Array, reply: object, over: Partial<CreateDeps> = {}, store = fakeStore()) {
  const db = fakeDb();
  const stub = createStubProvider([asText(reply)]);
  const deps: CreateDeps = {
    client: db.client,
    admin: db.client,
    who,
    vision: { provider: stub, entry: MODEL_CATALOG[5] },
    usage: null,
    log: vi.fn(),
    timeoutMs: 20_000,
    readFile: async () => ({ bytes, contentType: "image/png" }),
    store: () => store.store,
    pipeline: () => ({ provider: stub, template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: createPatternStage({ budget: createMatchBudget() }), cleanup: null, budget: createBudget(), standIn: false }),
    ...over,
  };
  return { deps, db, store, stub };
}

describe("pictures cut for a proposal", () => {
  it("stores the tile of each view as the person's artwork and points the alternative at it", async () => {
    const { deps, db, store } = await setup(await renderSheet(DOTS, "#c8102e"), SHEET_REPLY);
    const result = await createFromFile(deps, { fileId });
    if (result.kind !== "ready") throw new Error(result.reason);
    expect(store.added.map((a) => a.name)).toEqual(["design-tile-front.png", "design-tile-back.png"]);
    const stack = (db.rows[0] as { result: { layers: { id: string; assetId?: string }[] } }).result;
    const alternatives = stack.layers.filter((l) => l.id.endsWith("-alt"));
    expect(alternatives.map((l) => l.assetId)).toEqual(store.added.map((a) => a.id));
    expect(derivedIds(result.view.stack.layers)).toEqual(store.added.map((a) => a.id));
    expect(result.view.rows.find((r) => r.id === "pattern-front-alt")?.note).toMatch(/Not drawn until you choose it/);
  });

  it("stores a crest's crop and keeps the layer flagged for the person's own file", async () => {
    const tee = await renderTee({ extra: '<rect x="226" y="88" width="30" height="30" fill="#ffffff"/>' });
    const reply = { ...MARKS_REPLY, marks: [{ view: "front", kind: "crest", box: { x: 0.56, y: 0.22, w: 0.08, h: 0.1 } }] };
    const { deps, store } = await setup(tee.png, reply);
    const result = await createFromFile(deps, { fileId });
    if (result.kind !== "ready") throw new Error(result.reason);
    expect(store.added.map((a) => a.name)).toEqual(["design-crop-front-crop-1.png"]);
    const row = result.view.rows.find((r) => r.id === "mark-1");
    expect(row?.needsOwnFile).toBe(true);
    const layer = result.view.stack.layers.find((l) => l.id === "mark-1");
    expect(layer?.kind === "graphic" && layer.source).toEqual({ kind: "asset", assetId: store.added[0].id });
  });

  it("says when more crops were found than are stored", async () => {
    const tee = await renderTee();
    const marks = Array.from({ length: 10 }, (_, at) => ({ view: "front", kind: "sponsor", box: { x: 0.35 + (at % 5) * 0.04, y: 0.4 + Math.floor(at / 5) * 0.06, w: 0.035, h: 0.05 } }));
    const { deps, store } = await setup(tee.png, { ...MARKS_REPLY, marks });
    const result = await createFromFile(deps, { fileId });
    if (result.kind !== "ready") throw new Error(result.reason);
    expect(store.added).toHaveLength(8);
    expect(result.view.notes.join(" ")).toMatch(/More than 8 crests/);
  });

  it("removes what it stored when saving the proposal fails, and fails plainly when the store is down", async () => {
    const sheet = await renderSheet(DOTS, "#c8102e");
    const broken = await setup(sheet, SHEET_REPLY);
    broken.db.failOn("insert", { message: "db down" });
    await expect(createFromFile(broken.deps, { fileId })).rejects.toThrow();
    expect(broken.store.removed).toHaveLength(2);
    const down = await setup(sheet, SHEET_REPLY, {}, fakeStore({ failAt: 1 }));
    expect(await createFromFile(down.deps, { fileId })).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/could not be read just now/) });
    expect(down.store.removed).toHaveLength(1);
    expect(down.db.rows).toHaveLength(0);
  });

  it("takes in a vector mockup, and a WebP, through W7b's intake", async () => {
    const path = TEE_OUTLINE.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f2f2f2"/><path d="${path}" fill="#c8102e"/></svg>`;
    const vector = await setup(new Uint8Array(Buffer.from(svg)), { ...SHEET_REPLY, views: [{ view: "front", box: { x: 0, y: 0, w: 1, h: 1 } }] });
    const fromSvg = await createFromFile(vector.deps, { fileId });
    expect(fromSvg.kind).toBe("ready");
    const webp = new Uint8Array(await sharp((await renderTee()).png).webp({ lossless: true }).toBuffer());
    const web = await setup(webp, { ...SHEET_REPLY, views: [{ view: "front", box: { x: 0, y: 0, w: 1, h: 1 } }] });
    expect((await createFromFile(web.deps, { fileId })).kind).toBe("ready");
  });
});

describe("refit and pictures", () => {
  it("stores new pictures, removes the old ones, and keeps a crest the person already replaced", async () => {
    const tee = await renderTee({ extra: '<rect x="226" y="88" width="30" height="30" fill="#ffffff"/>' });
    const reply = { ...MARKS_REPLY, marks: [{ view: "front", kind: "crest", box: { x: 0.56, y: 0.22, w: 0.08, h: 0.1 } }] };
    const first = await setup(tee.png, reply);
    const created = await createFromFile(first.deps, { fileId });
    if (created.kind !== "ready") throw new Error(created.reason);
    const own = "bbbbbbbb-0000-4000-8000-000000000001";
    const row = first.db.rows[0] as { result: { layers: Record<string, unknown>[] } };
    row.result = { ...row.result, layers: row.result.layers.map((l) => (l.id === "mark-1" ? { ...l, source: { kind: "asset", assetId: own }, provenance: "user-edited" } : l)) };
    const second = fakeStore();
    const again = await refitImport({ ...first.deps, store: () => second.store }, created.view.id, { front: { hps: { x: 0.6, y: 0.1 } } });
    if (again.kind !== "ready") throw new Error(again.reason);
    const layer = again.view.stack.layers.find((l) => l.id === "mark-1");
    expect(layer?.kind === "graphic" && layer.source).toEqual({ kind: "asset", assetId: own });
    expect(layer?.provenance).toBe("user-edited");
    expect(again.view.rows.find((r) => r.id === "mark-1")?.needsOwnFile).toBe(false);
    expect(first.store.removed).toEqual([]);
    expect(second.removed).toEqual([]);
  });

  it("removes the old pictures after the new proposal is saved, and the new ones if it cannot be", async () => {
    const sheet = await renderSheet(DOTS, "#c8102e");
    const first = await setup(sheet, SHEET_REPLY);
    const created = await createFromFile(first.deps, { fileId });
    if (created.kind !== "ready") throw new Error(created.reason);
    const next = fakeStore();
    const ok = await refitImport({ ...first.deps, store: () => next.store }, created.view.id, {});
    expect(ok.kind).toBe("ready");
    expect(next.removed).toEqual(first.store.added.map((a) => a.id));
    const failing = fakeStore();
    first.db.failOn("update", { message: "db down" });
    await expect(refitImport({ ...first.deps, store: () => failing.store }, created.view.id, {})).rejects.toThrow();
    expect(failing.removed).toEqual(failing.added.map((a) => a.id));
    const down = await refitImport({ ...first.deps, store: () => fakeStore({ failAt: 0 }).store }, created.view.id, {});
    expect(down).toMatchObject({ kind: "rejection" });
  });
});
