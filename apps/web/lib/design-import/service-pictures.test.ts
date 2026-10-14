import { describe, expect, it, vi } from "vitest";
import { createFakePieceMapper, type AssetReader } from "@/lib/artwork-stack";
import { AppError } from "@/lib/server/core/errors";
import { createStubProvider } from "@/lib/providers/stub";
import { createBudget } from "./budget";
import { fakeDb } from "./fixtures/fake-db";
import { renderSheet, SHEET_REPLY, type KnownPattern } from "./fixtures/known";
import { MARKS_REPLY, asText } from "./fixtures/replies";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { renderTee } from "./fixtures/synthetic";
import { createMatchBudget } from "./match/budget";
import { createPatternStage } from "./match/stage";
import { runImport } from "./pipeline";
import { pendingPatternStage } from "./pattern";
import { ALREADY_SETTLED, BOTH_CHOSEN, CHOOSE_A_LAYER, NOT_A_LAYER, NOT_REPLACEABLE, NO_SUCH_ARTWORK, REPLACED_NOTE, acceptImport, chooseLayers, createImport, discardImport, getImport, needsOwnFile, replaceGraphic } from "./service";

// These run the real pattern matching on whole pictures, which is slower under coverage.
vi.setConfig({ testTimeout: 60_000 });

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const fileId = "55555555-5555-4555-8555-555555555555";
const artwork = "cccccccc-0000-4000-8000-000000000001";
const DOTS: KnownPattern = { generatorId: "kit-dots", params: { dotWidthMm: 20, pitchMm: 45, rowStepMm: 22.5, halfDrop: true }, colours: ["#ffffff"], ground: "#c8102e" };

const ready = async (bytes: Uint8Array, reply: object, pattern = pendingPatternStage) => {
  const out = await runImport({ bytes, mediaType: "image/png" }, { provider: createStubProvider([asText(reply)]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern, cleanup: null, budget: createBudget(), standIn: false });
  if (!out.ok) throw new Error(out.reason);
  const db = fakeDb();
  const id = await createImport(db.client, who, { sourceFileId: fileId, rightsAcceptedAt: new Date(), outcome: out, costMicrodollars: 0 });
  return { db, id, out };
};

const reader = (found: boolean): AssetReader => ({
  getAsset: async (id) =>
    found && id === artwork ? { id, kind: "raster", widthPx: 400, heightPx: 200, dpiMeta: null, colourSpace: "srgb", hasAlpha: true, readPrintCopy: async () => new Uint8Array(), readScreenCopy: async () => new Uint8Array() } : null,
});

const expectApp = async (promise: Promise<unknown>, code: string, message?: string) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  if (message) expect((error as AppError).message).toBe(message);
};

describe("an alternative repeating picture", () => {
  const stackOf = async () => (await ready(await renderSheet(DOTS, "#c8102e"), SHEET_REPLY, createPatternStage({ budget: createMatchBudget() }))).out.stack;

  it("is kept out of the stack with 'all', because the pattern it stands for is in", async () => {
    const stack = await stackOf();
    expect(stack.layers.map((l) => l.id)).toEqual(expect.arrayContaining(["pattern-front", "pattern-front-alt"]));
    const chosen = chooseLayers(stack, "all");
    expect(chosen.layers.some((l) => l.id.endsWith("-alt"))).toBe(false);
    expect(chosen.layers.some((l) => l.id === "pattern-front")).toBe(true);
  });

  it("is drawn once it is chosen in place of the pattern", async () => {
    const stack = await stackOf();
    expect(stack.layers.find((l) => l.id === "pattern-front-alt")?.opacity).toBe(0);
    const chosen = chooseLayers(stack, ["ground", "pattern-front-alt"]);
    expect(chosen.layers.find((l) => l.id === "pattern-front-alt")).toMatchObject({ opacity: 1, kind: "image-fill" });
    expect(chosen.layers.some((l) => l.id === "pattern-front")).toBe(false);
  });

  it("is refused together with its pattern, and the other choices still need a layer in the reading", async () => {
    const stack = await stackOf();
    expect(() => chooseLayers(stack, ["pattern-front", "pattern-front-alt"])).toThrow(BOTH_CHOSEN);
    expect(() => chooseLayers(stack, [])).toThrow(CHOOSE_A_LAYER);
    expect(() => chooseLayers(stack, ["nope"])).toThrow(NOT_A_LAYER);
  });
});

describe("replacing a crest redrawn from the picture", () => {
  const crestTee = async () => (await renderTee({ extra: '<rect x="226" y="88" width="30" height="30" fill="#ffffff"/>' })).png;
  const crestReply = { ...MARKS_REPLY, marks: [{ view: "front", kind: "crest", box: { x: 0.56, y: 0.22, w: 0.08, h: 0.1 } }] };

  it("points the layer at the person's own artwork, keeping its width and taking the file's proportions", async () => {
    const { db, id } = await ready(await crestTee(), crestReply);
    const before = (await getImport(db.client, who.brandId, id)).stack.layers.find((l) => l.id === "mark-1");
    await replaceGraphic(db.client, who, id, "mark-1", artwork, reader(true));
    const stored = await getImport(db.client, who.brandId, id);
    const layer = stored.stack.layers.find((l) => l.id === "mark-1");
    if (layer?.kind !== "graphic" || before?.kind !== "graphic") throw new Error("expected a graphic");
    expect(layer.source).toEqual({ kind: "asset", assetId: artwork });
    expect(layer.provenance).toBe("user-edited");
    expect(layer.widthMm).toBe(before.widthMm);
    expect(layer.heightMm).toBeCloseTo(before.widthMm / 2, 1);
    expect(needsOwnFile(stored.stack)).toEqual([]);
    expect(stored.report.items.find((i) => i.layerId === "mark-1")).toMatchObject({ confidence: 1, note: REPLACED_NOTE });
    expect(stored.status).toBe("ready");
  });

  it("refuses an artwork that is not this brand's, a layer that is not a redrawn graphic, and a settled reading", async () => {
    const { db, id } = await ready(await crestTee(), crestReply);
    await expectApp(replaceGraphic(db.client, who, id, "mark-1", artwork, reader(false)), "not_found", NO_SUCH_ARTWORK);
    await expectApp(replaceGraphic(db.client, who, id, "ground", artwork, reader(true)), "invalid_input", NOT_REPLACEABLE);
    await expectApp(replaceGraphic(db.client, who, id, "missing", artwork, reader(true)), "invalid_input", NOT_REPLACEABLE);
    await replaceGraphic(db.client, who, id, "mark-1", artwork, reader(true));
    await expectApp(replaceGraphic(db.client, who, id, "mark-1", artwork, reader(true)), "invalid_input", NOT_REPLACEABLE);
    await acceptImport(db.client, who, id, "all");
    await expectApp(replaceGraphic(db.client, who, id, "mark-1", artwork, reader(true)), "conflict", ALREADY_SETTLED);
  });

  it("does not let a database failure pass silently", async () => {
    const { db, id } = await ready(await crestTee(), crestReply);
    db.failOn("update", { message: "down" });
    await expect(replaceGraphic(db.client, who, id, "mark-1", artwork, reader(true))).rejects.toThrow(/could not be updated/);
  });
});

describe("cleaning up cut pictures", () => {
  it("tries to remove the pictures of layers that are not kept, and of a discarded reading, and ignores a failure", async () => {
    const { db, id } = await ready(await renderSheet(DOTS, "#c8102e"), SHEET_REPLY, createPatternStage({ budget: createMatchBudget() }));
    const row = db.rows[0] as { result: { layers: Record<string, unknown>[] } };
    row.result = { ...row.result, layers: row.result.layers.map((l) => (l.id === "pattern-front-alt" ? { ...l, assetId: "dddddddd-0000-4000-8000-000000000001" } : l)) };
    const accepted = await acceptImport(db.client, who, id, ["ground", "pattern-front"]);
    expect(accepted.stack.layers.map((l) => l.id)).toEqual(["ground", "pattern-front"]);
    const other = await ready(await renderSheet(DOTS, "#c8102e"), SHEET_REPLY, createPatternStage({ budget: createMatchBudget() }));
    const again = other.db.rows[0] as { result: { layers: Record<string, unknown>[] } };
    again.result = { ...again.result, layers: again.result.layers.map((l) => (l.id === "pattern-front-alt" ? { ...l, assetId: "dddddddd-0000-4000-8000-000000000002" } : l)) };
    await discardImport(other.db.client, who, other.id);
    expect(other.db.rows[0].status).toBe("discarded");
  });
});
