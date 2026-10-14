import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/lib/fabrics/fixtures/fake-db";
import { TOO_LARGE } from "@/lib/storage/read";
import type { RouteUsage } from "@/lib/server/core/metered";
import { ModelCallError } from "@/lib/providers/text-model";
import { createStubProvider } from "@/lib/providers/stub";
import { acceptImport, discardImport, loadImport, refitImport, startImport, type StartDeps } from "./service";
import { createImportStore } from "./store";
import { starterTemplate } from "./template";
import { recordedReading } from "./fixtures/fakes";
import { teePicture } from "./fixtures/synthetic";

const BRAND = "11111111-1111-4111-8111-111111111111";
const OTHER_BRAND = "33333333-3333-4333-8333-333333333333";
const USER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "44444444-4444-4444-8444-444444444444";
const FILE = "55555555-5555-4555-8555-555555555555";
const who = { brandId: BRAND, userId: USER };

const tee = async () => {
  const raster = teePicture({ garment: [27, 42, 73] });
  return new Uint8Array(await sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 4 } }).png().toBuffer());
};

async function setup(overrides: Partial<StartDeps> = {}, replies: string[] = [recordedReading()]) {
  const db = fakeDb();
  const store = { ...createImportStore(db.client), countSince: async () => 0 };
  const refund = vi.fn(async () => undefined);
  const usage: RouteUsage = { eventId: "e", refund, reserve: async () => null };
  const bytes = await tee();
  const provider = createStubProvider(replies);
  const deps: StartDeps = {
    store,
    enabled: true,
    provider,
    templates: starterTemplate,
    cleanup: null,
    projectInBrand: async (id) => id === PROJECT,
    readFile: async () => ({ bytes, contentType: "image/png" }),
    usage,
    priceOf: (budget) => budget.visionCalls * 1000,
    log: vi.fn(),
    timeoutMs: 20_000,
    dailyCap: 20,
    now: () => new Date("2026-10-15T10:00:00Z"),
    ...overrides,
  };
  return { db, store, deps, refund, provider };
}

const start = (deps: StartDeps) => startImport(deps, who, { projectId: PROJECT, fileId: FILE, size: "M" });

describe("startImport", () => {
  it("keeps a proposal and saves nothing as the design (case f)", async () => {
    const { db, deps } = await setup();
    const result = await start(deps);
    expect(result.kind).toBe("ready");
    const row = db.tables.design_imports[0];
    expect(row).toMatchObject({ brand_id: BRAND, project_id: PROJECT, source_file_id: FILE, status: "ready", vision_calls: 1, cost_microdollars: 1000 });
    expect(row.accepted_at).toBeUndefined();
    expect(row.accepted_by).toBeUndefined();
    expect(Object.keys(db.tables).sort()).toEqual(["design_imports"]);
    expect(db.calls.filter((c) => c.startsWith("spec_versions") || c.startsWith("projects"))).toEqual([]);
    if (result.kind === "ready") {
      expect(result.record.report?.items.every((i) => i.provenance === "read-from-image" && i.confidenceWords)).toBe(true);
      expect(result.record.stack?.layers[0].provenance).toBe("read-from-image");
    }
  });

  it("is refused while the switch is off, with the usage given back", async () => {
    const { deps, refund, db } = await setup({ enabled: false });
    expect(await start(deps)).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/not switched on/i) });
    expect(refund).toHaveBeenCalled();
    expect(db.tables.design_imports ?? []).toHaveLength(0);
    const noModel = await setup({ provider: null });
    expect((await start(noModel.deps)).kind).toBe("rejection");
  });

  it("refuses a project of another brand, a missing or oversize picture and a type it cannot open", async () => {
    const wrongProject = await setup({ projectInBrand: async () => false });
    expect(await start(wrongProject.deps)).toMatchObject({ kind: "rejection" });
    const missing = await setup({ readFile: async () => null });
    expect(await start(missing.deps)).toMatchObject({ reason: expect.stringMatching(/could not be found/i) });
    const large = await setup({ readFile: async () => TOO_LARGE });
    expect(await start(large.deps)).toMatchObject({ reason: expect.stringMatching(/too large/i) });
    const pdf = await setup({ readFile: async () => ({ bytes: new Uint8Array([1]), contentType: "application/pdf" }) });
    expect(await start(pdf.deps)).toMatchObject({ reason: expect.stringMatching(/PNG, JPEG or WebP/i) });
    const junk = await setup({ readFile: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" }) });
    expect(await start(junk.deps)).toMatchObject({ reason: expect.stringMatching(/could not be opened/i) });
    for (const s of [wrongProject, missing, large, pdf, junk]) expect(s.refund).toHaveBeenCalled();
    expect(wrongProject.db.tables.design_imports ?? []).toHaveLength(0);
  });

  it("marks the reading failed and refunds when the model call fails", async () => {
    const { deps, db, refund } = await setup({}, []);
    const failing = { ...deps, provider: createStubProvider([new ModelCallError("down", 529)]) };
    const result = await start(failing);
    expect(result).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/could not be read just now/i) });
    expect(db.tables.design_imports[0]).toMatchObject({ status: "failed", cost_microdollars: 0 });
    expect(refund).toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("keeps a failed reading with its cost, and says why, when nothing could be read", async () => {
    const { deps, db, refund } = await setup({}, ["nope", "nope"]);
    const result = await start(deps);
    expect(result).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/could not be read/i), id: expect.any(String) });
    expect(db.tables.design_imports[0]).toMatchObject({ status: "failed", vision_calls: 2, cost_microdollars: 2000 });
    expect(refund).not.toHaveBeenCalled();
  });
});

describe("the daily cap", () => {
  it("counts a brand's readings from the start of the UTC day, and refuses past the cap", async () => {
    const countSince = vi.fn(async () => 20);
    const { deps, refund } = await setup();
    const capped = { ...deps, store: { ...deps.store, countSince } };
    expect(await start(capped)).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/as many pictures as it can today/i) });
    expect(countSince).toHaveBeenCalledWith(BRAND, "2026-10-15T00:00:00.000Z");
    expect(refund).toHaveBeenCalled();
  });

  it("counts through the database with a time filter", async () => {
    const chain = { select: () => chain, eq: () => chain, gte: async () => ({ count: 3, error: null }) };
    const store = createImportStore({ from: () => chain } as never);
    expect(await store.countSince(BRAND, "2026-10-15T00:00:00.000Z")).toBe(3);
    const failing = { select: () => failing, eq: () => failing, gte: async () => ({ count: null, error: { message: "x" } }) };
    await expect(createImportStore({ from: () => failing } as never).countSince(BRAND, "x")).rejects.toThrow(/counted/);
    const none = { select: () => none, eq: () => none, gte: async () => ({ count: null, error: null }) };
    expect(await createImportStore({ from: () => none } as never).countSince(BRAND, "x")).toBe(0);
  });
});

describe("accepting, refitting and discarding", () => {
  const ready = async () => {
    const s = await setup();
    const result = await start(s.deps);
    if (result.kind !== "ready") throw new Error("expected a proposal");
    return { ...s, id: result.record.id, record: result.record };
  };

  it("records who accepted which layers and hands the accepted stack back", async () => {
    const { store, db, id } = await ready();
    const result = await acceptImport(store, who, id);
    expect(result).toMatchObject({ kind: "accepted", layerIds: ["ground"] });
    expect(db.tables.design_imports[0]).toMatchObject({ status: "accepted", accepted_by: USER, accepted_layers: ["ground"] });
    expect(typeof db.tables.design_imports[0].accepted_at).toBe("string");
    expect(await acceptImport(store, who, id)).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/already/i) });
  });

  it("accepts per layer, and refuses an unknown layer or none", async () => {
    const { store, id } = await ready();
    expect(await acceptImport(store, who, id, [])).toMatchObject({ kind: "rejection" });
    expect(await acceptImport(store, who, id, ["nothing"])).toMatchObject({ kind: "rejection" });
    expect(await acceptImport(store, who, id, ["ground"])).toMatchObject({ kind: "accepted" });
  });

  it("does not let another brand see, accept, refit or discard a reading", async () => {
    const { store, id } = await ready();
    const stranger = { brandId: OTHER_BRAND, userId: USER };
    expect(await loadImport(store, OTHER_BRAND, id)).toBeNull();
    expect(await acceptImport(store, stranger, id)).toMatchObject({ kind: "rejection" });
    expect(await discardImport(store, OTHER_BRAND, id)).toMatchObject({ kind: "rejection" });
    expect(await refitImport(store, starterTemplate, OTHER_BRAND, id, { view: "front", edits: [] })).toMatchObject({ kind: "rejection" });
    expect((await loadImport(store, BRAND, id))?.status).toBe("ready");
  });

  it("redoes the fit for a moved landmark without calling the model", async () => {
    const { store, provider, id } = await ready();
    const before = provider.requests.length;
    const moved = await refitImport(store, starterTemplate, BRAND, id, { view: "front", edits: [{ id: "underarm", side: "right", at: { x: 440, y: 200 } }] });
    expect(moved.kind).toBe("refit");
    if (moved.kind === "refit") {
      expect(moved.record.stored?.views[0].landmarks.find((l) => l.id === "underarm" && l.side === "right")?.origin).toBe("moved-by-you");
      expect(moved.record.report?.items.filter((i) => i.id === "fit-front")).toHaveLength(1);
    }
    expect(provider.requests.length).toBe(before);
    expect(await refitImport(store, starterTemplate, BRAND, id, { view: "back", edits: [] })).toMatchObject({ kind: "rejection" });
  });

  it("closes a reading that was discarded or accepted", async () => {
    const { store, id } = await ready();
    expect(await discardImport(store, BRAND, id)).toEqual({ kind: "discarded" });
    expect(await discardImport(store, BRAND, id)).toMatchObject({ kind: "rejection" });
    expect(await acceptImport(store, who, id)).toMatchObject({ kind: "rejection" });
    expect(await refitImport(store, starterTemplate, BRAND, id, { view: "front", edits: [] })).toMatchObject({ kind: "rejection" });
    expect(await acceptImport(store, who, "66666666-6666-4666-8666-666666666666")).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/does not exist/i) });
  });

  it("treats a row whose JSON does not parse as empty, not as trusted", async () => {
    const { store, db, id } = await ready();
    db.tables.design_imports[0].result_stack = { schemaVersion: 99 };
    db.tables.design_imports[0].report = { nonsense: true };
    const record = await loadImport(store, BRAND, id);
    expect(record?.stack).toBeNull();
    expect(record?.report).toBeNull();
    expect(await acceptImport(store, who, id)).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/not ready/i) });
  });

  it("surfaces database faults as errors", async () => {
    const { store, db, id } = await ready();
    db.failOn("design_imports", "update", { message: "boom" });
    await expect(acceptImport(store, who, id)).rejects.toThrow(/could not be accepted/i);
    await expect(discardImport(store, BRAND, id)).rejects.toThrow(/discarded/i);
    db.failOn("design_imports", "select", { message: "boom" });
    await expect(loadImport(store, BRAND, id)).rejects.toThrow(/loaded/i);
    db.failOn("design_imports", "insert", { message: "boom" });
    await expect(store.create(who, { projectId: PROJECT, fileId: FILE })).rejects.toThrow(/started/i);
  });
});
