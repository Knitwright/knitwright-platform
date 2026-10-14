import { describe, expect, it, vi } from "vitest";
import { createFakePieceMapper, parseArtworkStack } from "@/lib/artwork-stack";
import { createStubProvider } from "@/lib/providers/stub";
import { createBudget } from "./budget";
import { drawKnown, renderSheet, SHEET_REPLY, TEE_AREA, tiledList, type KnownPattern } from "./fixtures/known";
import { asText } from "./fixtures/replies";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { createMatchBudget, MATCH_LIMITS } from "./match/budget";
import { ERROR_LIMIT, createPatternStage } from "./match/stage";
import { runImport, type PipelineDeps } from "./pipeline";
import { FORBIDDEN_WORDS, reportSentences } from "./report";

// These run the real pattern matching on whole pictures, which is slower under coverage.
vi.setConfig({ testTimeout: 60_000 });

/** The picture is 1.5 design millimetres to a pixel (the synthetic template), so a truth in millimetres is a truth in the picture. */
const MM_PER_PX = 1.5;

const deps = (match = createMatchBudget()): PipelineDeps => ({
  provider: createStubProvider([asText(SHEET_REPLY)]),
  template: SYNTHETIC_TEMPLATE,
  mapper: createFakePieceMapper(),
  pattern: createPatternStage({ budget: match }),
  cleanup: null,
  budget: createBudget(),
  standIn: false,
});

const DOTS: KnownPattern = { generatorId: "kit-dots", params: { dotWidthMm: 20, pitchMm: 45, rowStepMm: 22.5, halfDrop: true }, colours: ["#ffffff"], ground: "#c8102e" };
const STRIPES: KnownPattern = { generatorId: "stripe-variations", params: { rhythm: 0, width: 24, angle: 45, grow: 0.5 }, colours: ["#1b2a49"], ground: "#c8102e", datum: { x: 5, y: 9 } };

const within = (found: unknown, truth: number, share: number): number => {
  const error = Math.abs(Number(found) - truth) / truth;
  expect(error).toBeLessThanOrEqual(share);
  return Math.round(error * 1000) / 10;
};

const run = async (pattern: KnownPattern, match = createMatchBudget()) => {
  const out = await runImport({ bytes: await renderSheet(pattern, "#c8102e"), mediaType: "image/png" }, deps(match));
  if (!out.ok) throw new Error(out.reason);
  return out;
};

describe("W7d acceptance, phase B", () => {
  it("(a) a front and back flat of a polka-dot jersey gives the dots style within a stated parameter error and a repeat within 10 % of the truth", async () => {
    const out = await run(DOTS);
    const patterns = out.stack.layers.filter((l) => l.kind === "pattern");
    expect(patterns.map((l) => l.views[0]).sort()).toEqual(["back", "front"]);
    const errors: string[] = [];
    for (const layer of patterns) {
      if (layer.kind !== "pattern") continue;
      expect(layer.generatorId).toBe("kit-dots");
      errors.push(`${layer.views[0]}: dot ${within(layer.params.dotWidthMm, 20, 0.15)}%, pitch ${within(layer.params.pitchMm, 45, 0.1)}%, row ${within(layer.params.rowStepMm, 22.5, 0.1)}%`);
      expect(layer.params.halfDrop).toBe(true);
      expect(layer.provenance).toBe("read-from-image");
    }
    const items = out.report.items.filter((i) => i.id.startsWith("pattern-") && !i.id.endsWith("-alt"));
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe("All-over pattern, as a pattern from our list");
    expect(items[0].note).toMatch(/estimated, check it/);
    // The repeat estimate, from the layer's alternative cut: one repeat is the pitch across and two row steps down.
    const tile = out.stack.layers.find((l) => l.kind === "image-fill" && l.views[0] === "front");
    expect(tile).toMatchObject({ opacity: 0, mode: "tile" });
    const cut = out.pictures.find((p) => p.view === "front");
    within(cut?.widthMm, 45, 0.1);
    expect(parseArtworkStack(out.stack).ok).toBe(true);
    console.info(`acceptance (a) measured: ${errors.join("; ")}; tile ${cut?.widthMm} mm across for a truth of 45 mm`);
  });

  it("(b) a camo all-over flat gives an image-fill tile, and the report says it is a repeating picture and why", async () => {
    const camo: KnownPattern = { generatorId: "camo", params: { scale: 30 }, colours: ["#2f5d34", "#6b8f3a", "#c8b27a"], ground: "#2f5d34", seed: 7 };
    // Camo's blobs are seeded and never repeat, so one 90 mm cell of it is drawn and laid side by side to make a printable repeat.
    const cell = drawKnown(camo, { minX: 0, minY: 0, maxX: 90, maxY: 90 });
    const bytes = await renderSheet(tiledList(cell, 90, TEE_AREA), "#2f5d34");
    const out = await runImport({ bytes, mediaType: "image/png" }, deps());
    if (!out.ok) throw new Error(out.reason);
    const fills = out.stack.layers.filter((l) => l.kind === "image-fill");
    expect(fills.map((l) => [l.views[0], l.mode, l.opacity]).sort()).toEqual([["back", "tile", 1], ["front", "tile", 1]]);
    expect(out.stack.layers.some((l) => l.kind === "pattern")).toBe(false);
    const item = out.report.items.find((i) => i.id === "pattern-1");
    expect(item?.label).toBe("All-over pattern, as a repeating picture");
    expect(item?.note).toMatch(/closest of our styles.*over the 15% limit/);
    const cut = out.pictures.find((p) => p.view === "front");
    within(cut?.widthMm, 90, 0.1);
    expect(cut?.png.byteLength).toBeGreaterThan(100);
    console.info(`acceptance (b) measured: image-fill tile; repeat ${cut?.widthMm} mm for a truth of 90 mm; ${item?.note.match(/differed on about \d+%/)?.[0]}`);
  });

  it("(b2) a camo with no repeat is kept as one full-panel picture per view, and the report says so", async () => {
    const camo: KnownPattern = { generatorId: "camo", params: { scale: 60 }, colours: ["#2f5d34", "#6b8f3a", "#c8b27a"], ground: "#2f5d34", seed: 7 };
    const out = await run(camo);
    expect(out.stack.layers.filter((l) => l.kind === "image-fill").map((l) => l.kind === "image-fill" && l.mode)).toEqual(["panel", "panel"]);
    expect(out.report.items.find((i) => i.id === "pattern-1")?.label).toBe("Full-panel picture");
    expect(out.pictures.every((p) => p.assetId.startsWith("panel-"))).toBe(true);
  });

  it("(c) a third style, stripes, is read by the same matching", async () => {
    const out = await run(STRIPES);
    const layer = out.stack.layers.find((l) => l.kind === "pattern");
    if (layer?.kind !== "pattern") throw new Error("expected a pattern layer");
    expect(layer.generatorId).toBe("stripe-variations");
    const widthError = within(layer.params.width, 24, 0.15);
    expect(Math.abs(Number(layer.params.angle) - 45)).toBeLessThanOrEqual(5);
    console.info(`acceptance (stripes) measured: width ${widthError}%, angle ${layer.params.angle}`);
  });

  it("states its limits and never claims a copy", async () => {
    const out = await run(DOTS);
    for (const sentence of reportSentences(out.report)) expect(sentence).not.toMatch(FORBIDDEN_WORDS);
    expect(out.report.notes.join(" ")).toContain(`${MATCH_LIMITS.renders} trial drawings`);
    expect(ERROR_LIMIT).toBe(0.15);
    expect(TEE_AREA.maxX).toBeGreaterThan(0);
    expect(MM_PER_PX).toBe(1.5);
  });
});
