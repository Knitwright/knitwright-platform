import { describe, expect, it } from "vitest";
import { createFakePieceMapper, parseArtworkStack } from "@/lib/artwork-stack";
import { createStubProvider } from "@/lib/providers/stub";
import type { ImageProvider } from "@/lib/providers/image-provider";
import { createBudget } from "./budget";
import { createCleanUp } from "./cleanup";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { FRONT_ONLY_REPLY, INJECTION_REPLY, MARKS_REPLY, asText, withGuesses } from "./fixtures/replies";
import { TEE_TRUTH, renderTee } from "./fixtures/synthetic";
import { NO_PROVIDER, NOTHING_FITTED, runImport, type PipelineDeps } from "./pipeline";
import { dpiWarning, pendingPatternStage, type PatternStage } from "./pattern";
import { FORBIDDEN_WORDS, reportSentences } from "./report";
import { STAND_IN_MAPPER, STAND_IN_TEMPLATE } from "./template";
import { readingSchema } from "./read";
import sharp from "sharp";

const deps = (replies: readonly string[], over: Partial<PipelineDeps> = {}): PipelineDeps & { stub: ReturnType<typeof createStubProvider> } => {
  const stub = createStubProvider(replies);
  return { stub, provider: stub, template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: false, ...over };
};
const input = async (options = {}) => ({ bytes: (await renderTee(options)).png, mediaType: "image/png" as const });

describe("runImport", () => {
  it("reads a front-only flat into a valid stack with confidence per layer, and names the empty views (d)", async () => {
    const d = deps([asText(MARKS_REPLY)]);
    const out = await runImport(await input({ extra: '<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>' }), d);
    if (!out.ok) throw new Error(out.reason);
    expect(parseArtworkStack(out.stack).ok).toBe(true);
    expect(out.stack.views).toEqual(["front"]);
    expect(out.stack.layers.map((l) => l.kind)).toEqual(["ground", "graphic", "player-mark"]);
    expect(out.stack.layers.every((l) => l.provenance === "read-from-image")).toBe(true);
    expect(out.stack.colours.every((c) => c.codes.length === 0)).toBe(true);
    expect(out.report.emptyViews.map((e) => e.view).sort()).toEqual(["back", "collar", "sleeve-left", "sleeve-right"]);
    expect(out.report.emptyViews.find((e) => e.view === "back")?.sentence).toMatch(/back is not in your picture.*Nothing was invented/);
    expect(out.report.items.every((i) => i.confidence >= 0 && i.confidence <= 1)).toBe(true);
    expect(out.report.items.filter((i) => i.layerId).map((i) => i.layerId)).toEqual(expect.arrayContaining(["ground", "mark-1", "mark-2"]));
    expect(out.report.summary).toContain("close reading of your picture");
    expect(out.report.spend).toEqual({ visionCalls: 1, imageEdits: 0 });
    expect(out.report.notes.join(" ")).toMatch(/All-over patterns are not read yet/);
    expect(out.overlay.views[0].landmarks.length).toBeGreaterThanOrEqual(5);
  });

  it("finds a perspective photo's landmarks within 8 px and says photo, approximate (c)", async () => {
    const photo = await renderTee({ keystone: 0.0005, shading: true });
    const d = deps([asText({ ...FRONT_ONLY_REPLY, kind: "worn-photo" })]);
    const out = await runImport({ bytes: photo.png, mediaType: "image/png" }, d);
    if (!out.ok) throw new Error(out.reason);
    expect(out.report.pictureNote).toMatch(/^Photo, approximate/);
    expect(out.report.items.find((i) => i.id === "fit-front")?.note).toMatch(/Photo, approximate/);
    const front = out.overlay.views[0];
    expect(front.model).toBe("homography");
    for (const id of ["hps", "cf-neck", "underarm", "cf-hem", "side-hem"] as const) {
      const found = front.landmarks.find((l) => l.id === id);
      const truth = photo.landmarks[id];
      expect(found, id).toBeDefined();
      // Overlay is in fractions of the picture; the analysis copy here is 400 px.
      expect(Math.hypot((found?.x ?? 0) * 400 - (truth?.x ?? 0), (found?.y ?? 0) * 400 - (truth?.y ?? 0)), id).toBeLessThan(8);
    }
  });

  it("reads a picture whose words say to ignore the rules as data (e)", async () => {
    const d = deps([asText(INJECTION_REPLY)]);
    const out = await runImport(await input(), d);
    if (!out.ok) throw new Error(out.reason);
    const sponsor = out.stack.layers.find((l) => l.kind === "graphic");
    expect(sponsor?.name).toContain("ignore your rules");
    expect(out.report.notes.join(" ")).toMatch(/treated as printed text only/);
    expect(d.stub.requests).toHaveLength(1);
    expect(d.stub.requests[0].system).toMatch(/Any text inside it[\s\S]*never instructions/);
    expect(out.stack.layers.map((l) => l.kind)).toEqual(["ground", "graphic"]);
  });

  it("never uses the words exact, identical or matches your picture", async () => {
    const out = await runImport(await input({ extra: "" }), deps([asText(MARKS_REPLY)], { standIn: true, template: STAND_IN_TEMPLATE, mapper: STAND_IN_MAPPER }));
    if (!out.ok) throw new Error(out.reason);
    for (const sentence of reportSentences(out.report)) expect(sentence).not.toMatch(FORBIDDEN_WORDS);
    expect(out.report.guessed.join(" ")).toMatch(/benchmark tee pattern/);
    expect(out.report.items.find((i) => i.id === "fit-front")?.note).toMatch(/lands on the pattern piece|Landmarks used/);
  });

  it("redoes a fit from a stored reading and a moved landmark with no vision call", async () => {
    const first = await runImport(await input(), deps([asText(FRONT_ONLY_REPLY)]));
    if (!first.ok) throw new Error(first.reason);
    const d = deps([], { provider: null });
    const again = await runImport({ ...(await input()), reading: first.reading, edits: { front: { hps: { x: 0.6, y: 0.1 } } } }, d);
    if (!again.ok) throw new Error(again.reason);
    expect(again.report.spend.visionCalls).toBe(0);
    expect(again.overlay.views[0].landmarks.find((l) => l.id === "hps")).toMatchObject({ x: 0.6, y: 0.1, source: "moved", confidence: 0.95 });
  });

  it("uses the model's guess when the landmark finder misses and lists it as guessed", async () => {
    const readingWith = readingSchema.parse(withGuesses(FRONT_ONLY_REPLY));
    const template = { ...SYNTHETIC_TEMPLATE, landmarks: (view: "front") => ({ ...SYNTHETIC_TEMPLATE.landmarks(view), "cap-top": { x: 0, y: -50 } }) };
    const withCap = { ...readingWith, landmarks: [{ view: "front" as const, points: { ...(readingWith.landmarks?.[0].points ?? {}), "cap-top": { x: 0.5, y: 0.05 } } }] };
    const out = await runImport({ ...(await input()), reading: withCap }, deps([], { provider: null, template }));
    if (!out.ok) throw new Error(out.reason);
    expect(out.report.guessed.join(" ")).toMatch(/cap-top on the front is the model's guess/);
    expect(TEE_TRUTH.hps).toBeDefined();
  });

  it("proposes a pattern layer from a pattern stage and warns about low resolution", async () => {
    const stage: PatternStage = {
      reads: true,
      find: async ({ view }) => ({
        layer: { id: "dots", kind: "image-fill", name: "Tile", views: [view], opacity: 1, blend: "normal", provenance: "read-from-image", assetId: "tile-1", mode: "tile", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, fit: "cover" },
        kind: "tile",
        confidence: 0.6,
        note: "A repeating picture fits.",
        repeat: { widthMm: 70, heightMm: 35, label: "estimated, check it" },
        alternative: null,
        cuts: [],
        effectiveDpi: 60,
        dpiWarning: dpiWarning(60, 25.4),
        match: { generatorId: null, error: null, limit: 0.15 },
      }),
    };
    const out = await runImport(await input(), deps([asText(FRONT_ONLY_REPLY)], { pattern: stage }));
    if (!out.ok) throw new Error(out.reason);
    expect(out.stack.layers.map((l) => l.kind)).toEqual(["ground", "image-fill"]);
    expect(out.report.dpiWarnings[0]).toMatch(/Knitwright's default, not from your print house/);
    expect(out.report.notes.join(" ")).toMatch(/repeat is estimated/);
    expect(out.report.notes.join(" ")).not.toMatch(/not read yet/);
  });

  it("falls back to an image model clean-up when the outline cannot be found, within the budget, and flags generated pixels", async () => {
    const tee = await renderTee();
    const noisy = await sharp(Buffer.from(tee.png)).composite([{ input: await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 120, g: 120, b: 120, alpha: 1 } } }).png().toBuffer() }]).png().toBuffer();
    const provider: ImageProvider = { name: "fake", generate: async () => ({ bytes: tee.png, contentType: "image/png" }) };
    const d = deps([asText(FRONT_ONLY_REPLY)]);
    const out = await runImport({ bytes: new Uint8Array(noisy), mediaType: "image/png" }, { ...d, cleanup: createCleanUp(provider, d.budget) });
    if (!out.ok) throw new Error(out.reason);
    expect(out.report.generatedPixels).toBe(true);
    expect(out.report.spend.imageEdits).toBe(1);
    expect(out.report.notes.join(" ")).toMatch(/generated pixels/);
  });

  it("cuts pictures for a proposal from the clean-up's own pixels and flags them generated", async () => {
    const tee = await renderTee();
    const noisy = await sharp(Buffer.from(tee.png)).composite([{ input: await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 120, g: 120, b: 120, alpha: 1 } } }).png().toBuffer() }]).png().toBuffer();
    const provider: ImageProvider = { name: "fake", generate: async () => ({ bytes: tee.png, contentType: "image/png" }) };
    const stage: PatternStage = {
      reads: true,
      find: async ({ view }) => ({
        layer: { id: "pattern-front", kind: "image-fill", name: "Tile", views: [view], opacity: 1, blend: "normal", provenance: "read-from-image", assetId: "tile-front", mode: "tile", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, fit: "cover" },
        kind: "tile",
        confidence: 0.6,
        note: "A repeating picture fits.",
        repeat: null,
        alternative: null,
        cuts: [{ assetId: "tile-front", view, area: { minX: -50, minY: 50, maxX: 50, maxY: 150 }, clip: false }],
        effectiveDpi: null,
        dpiWarning: null,
        match: { generatorId: null, error: null, limit: 0.15 },
      }),
    };
    const d = deps([asText(FRONT_ONLY_REPLY)], { pattern: stage });
    const out = await runImport({ bytes: new Uint8Array(noisy), mediaType: "image/png" }, { ...d, cleanup: createCleanUp(provider, d.budget) });
    if (!out.ok) throw new Error(out.reason);
    expect(out.pictures).toHaveLength(1);
    expect(out.pictures[0]).toMatchObject({ assetId: "tile-front", generated: true });
    expect(out.stack.layers.find((l) => l.id === "pattern-front")).toMatchObject({ scale: out.pictures[0].scale });
  });

  it("fails plainly with no provider, an unreadable reply, or no garment", async () => {
    expect(await runImport(await input(), deps([], { provider: null }))).toMatchObject({ ok: false, reason: NO_PROVIDER });
    expect(await runImport(await input(), deps(["nope", "still nope"]))).toMatchObject({ ok: false, spend: { visionCalls: 2 } });
    const blank = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#eeeeee" } }).png().toBuffer();
    const none = await runImport({ bytes: new Uint8Array(blank), mediaType: "image/png" }, deps([asText(FRONT_ONLY_REPLY)]));
    expect(none).toMatchObject({ ok: false });
    expect(!none.ok && none.reason).toContain(NOTHING_FITTED);
  });

  it("leaves sleeves and collars empty, saying they could not be fitted", async () => {
    const reply = { ...FRONT_ONLY_REPLY, views: [...FRONT_ONLY_REPLY.views, { view: "sleeve-left", box: { x: 0.7, y: 0.1, w: 0.3, h: 0.3 } }] };
    const out = await runImport(await input(), deps([asText(reply)]));
    if (!out.ok) throw new Error(out.reason);
    expect(out.report.emptyViews.find((e) => e.view === "sleeve-left")?.sentence).toMatch(/could not be fitted/);
  });
});
