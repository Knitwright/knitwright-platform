import { describe, expect, it } from "vitest";
import { createFakePieceMapper } from "@/lib/artwork-stack";
import { AppError } from "@/lib/server/core/errors";
import { createStubProvider } from "@/lib/providers/stub";
import { createBudget } from "./budget";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { fakeDb } from "./fixtures/fake-db";
import { MARKS_REPLY, asText } from "./fixtures/replies";
import { renderTee } from "./fixtures/synthetic";
import { pendingPatternStage } from "./pattern";
import { runImport } from "./pipeline";
import { ALREADY_SETTLED, CHOOSE_A_LAYER, DAILY_BRAND_CAP, IMPORT_NOT_FOUND, NOT_A_LAYER, OVER_DAILY_CAP, acceptImport, assertUnderDailyCap, chooseLayers, createImport, discardImport, getImport, listImports, needsOwnFile, replaceProposal } from "./service";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const other = { brandId: "33333333-3333-4333-8333-333333333333", userId: "44444444-4444-4444-8444-444444444444" };
const fileId = "55555555-5555-4555-8555-555555555555";

async function outcome() {
  const png = (await renderTee({ extra: '<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>' })).png;
  const out = await runImport(
    { bytes: png, mediaType: "image/png" },
    { provider: createStubProvider([asText(MARKS_REPLY)]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: false },
  );
  if (!out.ok) throw new Error(out.reason);
  return out;
}

const expectApp = async (promise: Promise<unknown>, code: string, message?: string) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  if (message) expect((error as AppError).message).toBe(message);
};

const make = async (db = fakeDb()) => {
  const id = await createImport(db.client, who, { sourceFileId: fileId, rightsAcceptedAt: new Date("2026-10-15T00:00:00Z"), outcome: await outcome(), costMicrodollars: 1234 });
  return { db, id };
};

describe("design imports", () => {
  it("keeps a proposal with no accepted stack until the person accepts (f)", async () => {
    const { db, id } = await make();
    const row = db.rows[0];
    expect(row).toMatchObject({ brand_id: who.brandId, status: "ready", accepted_stack: null, vision_calls: 1, cost_microdollars: 1234, created_by: who.userId });
    const stored = await getImport(db.client, who.brandId, id);
    expect(stored.status).toBe("ready");
    expect(stored.acceptedStack).toBeNull();
    expect(stored.report.items.length).toBeGreaterThan(1);
    await acceptImport(db.client, who, id, "all", new Date("2026-10-15T01:00:00Z"));
    expect(db.rows[0]).toMatchObject({ status: "accepted", accepted_by: who.userId, accepted_at: "2026-10-15T01:00:00.000Z" });
    expect((await getImport(db.client, who.brandId, id)).acceptedStack?.layers).toHaveLength(stored.stack.layers.length);
  });

  it("accepts only the layers chosen and names the ones that need the person's own file", async () => {
    const { db, id } = await make();
    const stored = await getImport(db.client, who.brandId, id);
    const crest = stored.stack.layers.find((l) => l.kind === "graphic")?.id as string;
    const result = await acceptImport(db.client, who, id, ["ground", crest]);
    expect(result.stack.layers.map((l) => l.id)).toEqual(["ground", crest]);
    expect(result.needsOwnFile).toEqual([crest]);
    expect(db.rows[0].accepted_layer_ids).toEqual(["ground", crest]);
  });

  it("refuses an empty choice, an unknown layer and a second decision", async () => {
    const { db, id } = await make();
    const stored = await getImport(db.client, who.brandId, id);
    expect(() => chooseLayers(stored.stack, [])).toThrow(CHOOSE_A_LAYER);
    await expectApp(acceptImport(db.client, who, id, ["nope"]), "invalid_input", NOT_A_LAYER);
    await acceptImport(db.client, who, id, "all");
    await expectApp(acceptImport(db.client, who, id, "all"), "conflict", ALREADY_SETTLED);
    await expectApp(discardImport(db.client, who, id), "conflict", ALREADY_SETTLED);
    await expectApp(replaceProposal(db.client, who, id, await outcome()), "conflict", ALREADY_SETTLED);
  });

  it("discards, and a discarded import never has an accepted stack", async () => {
    const { db, id } = await make();
    await discardImport(db.client, who, id);
    expect(db.rows[0]).toMatchObject({ status: "discarded", accepted_stack: null });
  });

  it("replaces a ready proposal when a fit is redone", async () => {
    const { db, id } = await make();
    const next = await outcome();
    await replaceProposal(db.client, who, id, { ...next, report: { ...next.report, summary: "Redone." } });
    expect((await getImport(db.client, who.brandId, id)).report.summary).toBe("Redone.");
  });

  it("shows a brand only its own imports", async () => {
    const { db, id } = await make();
    await expectApp(getImport(db.client, other.brandId, id), "not_found", IMPORT_NOT_FOUND);
    await expectApp(acceptImport(db.client, other, id, "all"), "not_found");
    expect(await listImports(db.client, other.brandId)).toEqual([]);
    const [summary] = await listImports(db.client, who.brandId);
    expect(summary).toMatchObject({ id, status: "ready" });
    expect(summary.confidence).toBeGreaterThan(0);
  });

  it("caps a brand at the day's allowance and not before", async () => {
    const now = new Date("2026-10-15T12:00:00Z");
    const recent = Array.from({ length: DAILY_BRAND_CAP - 1 }, () => ({ brand_id: who.brandId, created_at: "2026-10-15T06:00:00.000Z" }));
    const old = { brand_id: who.brandId, created_at: "2026-10-13T06:00:00.000Z" };
    const db = fakeDb([...recent, old]);
    await assertUnderDailyCap(db.client, who.brandId, now);
    db.rows.push({ brand_id: who.brandId, created_at: "2026-10-15T07:00:00.000Z" });
    await expectApp(assertUnderDailyCap(db.client, who.brandId, now), "rate_limited", OVER_DAILY_CAP);
    await assertUnderDailyCap(db.client, other.brandId, now);
  });

  it("reports a database fault plainly and rejects a malformed row", async () => {
    const db = fakeDb();
    db.failOn("insert", { message: "down" });
    await expect(createImport(db.client, who, { sourceFileId: fileId, rightsAcceptedAt: new Date(), outcome: await outcome(), costMicrodollars: 0 })).rejects.toThrow(/could not be saved/);
    const bad = fakeDb([{ id: fileId, brand_id: who.brandId }]);
    await expect(getImport(bad.client, who.brandId, fileId)).rejects.toThrow(/unexpected answer/);
    const failing = fakeDb();
    failing.failOn("select", { message: "down" });
    await expect(listImports(failing.client, who.brandId)).rejects.toThrow(/could not be read/);
    await expect(assertUnderDailyCap(failing.client, who.brandId)).rejects.toThrow(/could not be counted/);
    expect(needsOwnFile((await outcome()).stack)).toEqual(["mark-2"]);
  });
});
