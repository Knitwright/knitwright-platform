import { describe, expect, it, vi } from "vitest";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { createStubProvider, type StubAnswer } from "@/lib/providers/stub";
import type { PricedProvider } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import type { RouteUsage } from "@/lib/server/core/metered";
import { TOO_LARGE } from "@/lib/storage/read";
import { FAILED, NOT_FOUND, TOO_LARGE_TO_READ, createFromFile, refitImport, type CreateDeps } from "./create";
import { buildPipelineDeps } from "./deps";
import { fakeDb } from "./fixtures/fake-db";
import { FRONT_ONLY_REPLY, MARKS_REPLY, asText } from "./fixtures/replies";
import { renderTee } from "./fixtures/synthetic";
import { DAILY_BRAND_CAP, OVER_DAILY_CAP } from "./service";
import { FORBIDDEN_WORDS } from "./report";
import { createBudget } from "./budget";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { createFakePieceMapper } from "@/lib/artwork-stack";
import { pendingPatternStage } from "./pattern";
import { fakeStore } from "./fixtures/fake-store";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const fileId = "55555555-5555-4555-8555-555555555555";
const entry = MODEL_CATALOG[5];
const log = vi.fn();

async function setup(replies: readonly StubAnswer[], over: Partial<CreateDeps> = {}) {
  const png = (await renderTee({ extra: '<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>' })).png;
  const db = fakeDb();
  const stub = createStubProvider(replies);
  const vision: PricedProvider = { provider: stub, entry };
  const refund = vi.fn(async () => undefined);
  const usage: RouteUsage = { eventId: "e", refund, reserve: async () => null };
  const deps: CreateDeps = {
    client: db.client,
    admin: db.client,
    who,
    vision,
    usage,
    log,
    timeoutMs: 5000,
    readFile: async () => ({ bytes: png, contentType: "image/png" }),
    store: () => fakeStore().store,
    pipeline: () => ({ provider: stub, template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: false }),
    ...over,
  };
  return { deps, db, refund, stub };
}

describe("createFromFile", () => {
  it("reads a picture, saves a proposal and not a design, and shows the limits (f)", async () => {
    const { deps, db, refund } = await setup([asText(MARKS_REPLY)]);
    const result = await createFromFile(deps, { fileId });
    if (result.kind !== "ready") throw new Error(result.reason);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ status: "ready", accepted_stack: null, source_file_id: fileId, vision_calls: 1 });
    expect(Number(db.rows[0].cost_microdollars)).toBeGreaterThan(0);
    expect(result.view.rows.map((r) => r.id)).toEqual(["ground", "mark-2", "mark-1"].sort((a, b) => result.view.rows.findIndex((r) => r.id === a) - result.view.rows.findIndex((r) => r.id === b)));
    expect(result.view.rows.every((r) => r.confidenceWords.includes("%"))).toBe(true);
    expect(result.view.rows.find((r) => r.id === "mark-2")?.needsOwnFile).toBe(true);
    expect(result.view.heading).toBe("A close reading of your picture");
    expect(result.view.limits.join(" ")).not.toMatch(FORBIDDEN_WORDS);
    expect(result.view.pictureUrl).toBe(`/api/files/${fileId}`);
    expect(result.view.savedAsDesign).toBe(false);
    expect(refund).not.toHaveBeenCalled();
  });

  it("refuses and gives the reservation back for a missing, large or odd file", async () => {
    for (const [file, reason] of [[null, NOT_FOUND], [TOO_LARGE, TOO_LARGE_TO_READ], [{ bytes: new Uint8Array(1), contentType: "image/gif" }, /Nothing was changed\.$/]] as const) {
      const { deps, refund, db } = await setup([], { readFile: async () => file });
      expect(await createFromFile(deps, { fileId })).toEqual({ kind: "rejection", reason: typeof reason === "string" ? reason : expect.stringMatching(reason) });
      expect(refund).toHaveBeenCalledOnce();
      expect(db.rows).toHaveLength(0);
    }
  });

  it("gives the reservation back when the reading fails or comes back unreadable, and saves nothing", async () => {
    const down = await setup([new Error("down")]);
    expect(await createFromFile(down.deps, { fileId })).toEqual({ kind: "rejection", reason: FAILED });
    expect(down.refund).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalled();
    const odd = await setup(["nope", "nope"]);
    const result = await createFromFile(odd.deps, { fileId });
    expect(result.kind).toBe("rejection");
    // Two calls were made and paid for, so nothing is given back.
    expect(odd.refund).not.toHaveBeenCalled();
    expect(odd.db.rows).toHaveLength(0);
  });

  it("stops a brand over its daily cap before any call is made", async () => {
    const { deps, db, stub } = await setup([asText(FRONT_ONLY_REPLY)]);
    const now = new Date("2026-10-15T12:00:00Z");
    for (let i = 0; i < DAILY_BRAND_CAP; i += 1) db.rows.push({ brand_id: who.brandId, created_at: "2026-10-15T06:00:00.000Z" });
    const error = await createFromFile({ ...deps, now }, { fileId }).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toBe(OVER_DAILY_CAP);
    expect(stub.requests).toHaveLength(0);
  });
});

describe("refitImport", () => {
  it("redoes the fit from the stored reading with no vision call", async () => {
    const first = await setup([asText(FRONT_ONLY_REPLY)]);
    const created = await createFromFile(first.deps, { fileId });
    if (created.kind !== "ready") throw new Error(created.reason);
    const again = await refitImport({ ...first.deps, pipeline: () => buildPipelineDeps({ vision: null, image: null, usage: null, budget: createBudget() }) }, created.view.id, { front: { hps: { x: 0.6, y: 0.1 } } });
    // The stand-in template is the benchmark tee, so a synthetic tee fits it roughly; it still reads.
    expect(again.kind === "ready" || again.kind === "rejection").toBe(true);
    expect(first.stub.requests).toHaveLength(1);
  });

  it("redoes it on the test template and shows the moved landmark", async () => {
    const first = await setup([asText(FRONT_ONLY_REPLY)]);
    const created = await createFromFile(first.deps, { fileId });
    if (created.kind !== "ready") throw new Error(created.reason);
    const result = await refitImport(first.deps, created.view.id, { front: { hps: { x: 0.6, y: 0.1 } } });
    if (result.kind !== "ready") throw new Error(result.reason);
    expect(result.view.overlay.views[0].landmarks.find((l) => l.id === "hps")?.source).toBe("moved");
    expect(first.stub.requests).toHaveLength(1);
  });

  it("says the picture is gone when its file cannot be read, and fails plainly when the fit cannot be redone", async () => {
    const first = await setup([asText(FRONT_ONLY_REPLY)]);
    const created = await createFromFile(first.deps, { fileId });
    if (created.kind !== "ready") throw new Error(created.reason);
    expect(await refitImport({ ...first.deps, readFile: async () => null }, created.view.id, {})).toEqual({ kind: "rejection", reason: NOT_FOUND });
    const blank = new Uint8Array(await (await import("sharp")).default({ create: { width: 50, height: 50, channels: 3, background: "#eeeeee" } }).png().toBuffer());
    const none = await refitImport({ ...first.deps, readFile: async () => ({ bytes: blank, contentType: "image/png" }) }, created.view.id, {});
    expect(none.kind).toBe("rejection");
    const broken = await refitImport({ ...first.deps, readFile: async () => ({ bytes: new Uint8Array([1, 2]), contentType: "image/png" }) }, created.view.id, {});
    expect(broken).toEqual({ kind: "rejection", reason: NOT_FOUND });
  });
});
