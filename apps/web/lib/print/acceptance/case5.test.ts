import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createFakePieceMapper, parseArtworkStack, type ArtworkStack } from "@/lib/artwork-stack";
import { createBudget } from "@/lib/design-import/budget";
import { SYNTHETIC_TEMPLATE } from "@/lib/design-import/fixtures/template";
import { asText } from "@/lib/design-import/fixtures/replies";
import { renderSheet, SHEET_REPLY, type KnownPattern } from "@/lib/design-import/fixtures/known";
import { createMatchBudget } from "@/lib/design-import/match/budget";
import { createPatternStage } from "@/lib/design-import/match/stage";
import { runImport } from "@/lib/design-import/pipeline";
import { createStubProvider } from "@/lib/providers/stub";
import { flattenScene } from "../render/raster";
import { deltaE } from "../rules/colour";
import { realWorld, specOf, type RealWorld } from "../fixtures/real";

/**
 * Plan W3, acceptance case 5, with W7d phase B (merged): a mockup whose true stack is known (a red tee with white polka
 * dots, 16 mm dots on a 36 mm pitch, rows 18 mm apart, every other row shifted) is drawn to a flat, read by W7d's real
 * pipeline and pattern step from a recorded reply, and the stack it gives is printed. It is compared with the print
 * of the true stack.
 *
 * The limit, stated here: the AVERAGE colour of the print differs from the true print by under 2.3 (CIE76, about the
 * least difference an eye sees). Pixel by pixel the two are not compared: the read repeat is a few per cent off the
 * truth (W7d holds it within 10 %), so the dots drift apart across the piece and a pixel-wise difference (about 30
 * here) measures the drift, not the colours.
 */
export const MEAN_COLOUR_LIMIT = 2.3;
export const PICTURE_NOTE = "Read from a picture. Compare with the picture before printing.";

const TRUTH: KnownPattern = { generatorId: "kit-dots", params: { dotWidthMm: 16, pitchMm: 36, rowStepMm: 18, halfDrop: true }, colours: ["#ffffff"], ground: "#c8102e" };

async function derivedStack(): Promise<ArtworkStack> {
  const out = await runImport(
    { bytes: await renderSheet(TRUTH, "#c8102e"), mediaType: "image/png" },
    { provider: createStubProvider([asText(SHEET_REPLY)]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: createPatternStage({ budget: createMatchBudget() }), cleanup: null, budget: createBudget(), standIn: false },
  );
  if (!out.ok) throw new Error(out.reason);
  return out.stack;
}

/** The true print of the mockup: the stack a designer would have made it from, known exactly. */
function trueStack(): ArtworkStack {
  const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
  const parsed = parseArtworkStack({
    schemaVersion: 1,
    views: ["front", "back"],
    colours: [{ id: "colour-1", role: "Ground", screen: "#c8102e", codes: [], provenance: "user-edited" }, { id: "colour-2", role: "Dots", screen: "#ffffff", codes: [], provenance: "user-edited" }],
    colourways: [{ id: "as-read", name: "True", colours: {} }],
    layers: [
      { ...common, id: "ground", kind: "ground", views: ["front", "back"], colourId: "colour-1" },
      { ...common, id: "dots", kind: "pattern", views: ["front", "back"], generatorId: TRUTH.generatorId, params: TRUTH.params, datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } }, colourIds: ["colour-2"] },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.stack;
}

const SIZE = 80;

async function pixelsOf(png: Uint8Array): Promise<string[]> {
  const { data } = await sharp(png).flatten({ background: "#ffffff" }).resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return Array.from({ length: SIZE * SIZE }, (_, at) => `#${[0, 1, 2].map((k) => data[at * 3 + k]!.toString(16).padStart(2, "0")).join("")}`);
}

const averageOf = (hexes: readonly string[]): string => {
  const sum = [0, 0, 0];
  for (const hex of hexes) [1, 3, 5].forEach((at, k) => (sum[k]! += parseInt(hex.slice(at, at + 2), 16)));
  return `#${sum.map((v) => Math.round(v / hexes.length).toString(16).padStart(2, "0")).join("")}`;
};

const flat = async (world: RealWorld, stack: ArtworkStack, size: string, view: string): Promise<Uint8Array> =>
  (await flattenScene((await world.builder(stack, { colourwayId: stack.colourways[0]!.id }).buildFile(specOf(view, size, "svg"))).scene.scene, { dpi: 20 })).png;

describe("case 5: a design read from a picture, by W7d's real pattern step", () => {
  it("reads the dots style and prints it, and every file of every size carries the picture note", async () => {
    const world = await realWorld();
    const stack = await derivedStack();
    const pattern = stack.layers.find((l) => l.kind === "pattern" && l.views.includes("front"));
    expect(pattern).toMatchObject({ generatorId: "kit-dots", provenance: "read-from-image" });
    const builder = world.builder(stack, { colourwayId: stack.colourways[0]!.id });
    for (const size of world.pattern.sizes) {
      for (const placed of builder.mapper.placed(size)) {
        const file = await builder.buildFile(specOf(placed.instance.id, size, "svg"));
        expect(file.scene.scene.noteLines, `${size} ${placed.instance.id}`).toContain(PICTURE_NOTE);
        expect(file.scene.scene.issues.filter((i) => i.severity === "stop"), `${size} ${placed.instance.id}`).toEqual([]);
      }
    }
  }, 240_000);

  it(`has an average colour within ${MEAN_COLOUR_LIMIT} of the true print, on the front and on the back`, async () => {
    const world = await realWorld();
    const stack = await derivedStack();
    for (const [size, view] of [["S", "front"], ["L", "back"]] as const) {
      const [got, want] = await Promise.all([stack, trueStack()].map(async (s) => pixelsOf(await flat(world, s, size, view))));
      expect(deltaE(averageOf(got!), averageOf(want!)), `average colour, ${size} ${view}`).toBeLessThan(MEAN_COLOUR_LIMIT);
    }
  }, 240_000);

  it("keeps the alternative the reader leaves (the picture as a repeat, at no opacity) out of the print and does not read its picture", async () => {
    const world = await realWorld();
    const stack = await derivedStack();
    expect(stack.layers.some((l) => l.kind === "image-fill" && l.opacity === 0)).toBe(true);
    const front = await world.builder(stack, { colourwayId: stack.colourways[0]!.id }).buildFile(specOf("front", "M", "svg"));
    expect(front.scene.scene.items.some((i) => i.kind === "image")).toBe(false);
    expect(front.scene.scene.issues.some((i) => /not available/.test(i.text))).toBe(false);
  }, 120_000);
});
