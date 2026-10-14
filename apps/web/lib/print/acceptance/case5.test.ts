import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createFakePieceMapper, parseArtworkStack, type ArtworkStack } from "@/lib/artwork-stack";
import { createBudget } from "@/lib/design-import/budget";
import { SYNTHETIC_TEMPLATE } from "@/lib/design-import/fixtures/template";
import { MARKS_REPLY, asText } from "@/lib/design-import/fixtures/replies";
import { renderTee } from "@/lib/design-import/fixtures/synthetic";
import { pendingPatternStage } from "@/lib/design-import/pattern";
import { runImport } from "@/lib/design-import/pipeline";
import { createStubProvider } from "@/lib/providers/stub";
import { flattenScene } from "../render/raster";
import { deltaE } from "../rules/colour";
import { realWorld, specOf, type RealWorld } from "../fixtures/real";

/**
 * Plan W3, acceptance case 5. W7d's pattern step (phase B, PR 28) has not merged, so this uses W7d phase A's real output
 * (a recorded reply read by the real pipeline) plus a RECORDED generator choice for the all-over pattern: the choice a
 * pattern step would make for this picture (white hoops, 40 mm), written by hand. When W7d phase B merges, the recorded
 * choice is replaced by its output and the limit below is kept.
 */
export const MEAN_DELTA_E_LIMIT = 6;
export const PICTURE_NOTE = "Read from a picture. Compare with the picture before printing.";

const RECORDED_CHOICE = { generatorId: "kit-hoops", params: { bandWidthMm: 40 }, colourId: "colour-3" } as const;

const hoopsAt = (): string => [0, 1, 2, 3].map((n) => `<rect x="0" y="${100 + n * 50}" width="400" height="25" fill="#ffffff"/>`).join("");

async function derivedStack(world: RealWorld, withCrest: boolean): Promise<{ stack: ArtworkStack }> {
  const tee = await renderTee({ extra: `<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>${hoopsAt()}` });
  const out = await runImport({ bytes: tee.png, mediaType: "image/png" }, { provider: createStubProvider([asText(withCrest ? MARKS_REPLY : { ...MARKS_REPLY, marks: MARKS_REPLY.marks.slice(0, 1) })]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: false });
  if (!out.ok) throw new Error(out.reason);
  // The crest is a crop of the picture: it becomes a real artwork through the real intake, as it would when the design is accepted.
  const crop = out.crops[0];
  const png = crop && (await sharp(tee.png).extract({ left: Math.round(crop.rect.x0), top: Math.round(crop.rect.y0), width: Math.max(1, Math.round(crop.rect.x1 - crop.rect.x0)), height: Math.max(1, Math.round(crop.rect.y1 - crop.rect.y0)) }).png().toBuffer());
  const artwork = png ? await world.upload(new Uint8Array(png), "Crest from picture.png") : "";
  const layers = out.stack.layers.flatMap((layer): unknown[] => {
    if (layer.id === "ground") {
      return [layer, { id: "recorded-hoops", name: "Hoops (recorded choice)", views: ["front"], opacity: 1, blend: "normal", provenance: "read-from-image", kind: "pattern", generatorId: RECORDED_CHOICE.generatorId, params: RECORDED_CHOICE.params, datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } }, colourIds: [RECORDED_CHOICE.colourId] }];
    }
    return [layer.kind === "graphic" ? { ...layer, source: { kind: "asset", assetId: artwork } } : layer];
  });
  const parsed = parseArtworkStack({ ...out.stack, layers });
  if (!parsed.ok) throw new Error(parsed.reason);
  return { stack: parsed.stack };
}

/** The true print of the mockup: the stack a designer would have made it from, known exactly. */
function trueStack(): ArtworkStack {
  const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
  const parsed = parseArtworkStack({
    schemaVersion: 1,
    views: ["front"],
    colours: [{ id: "colour-1", role: "Ground", screen: "#c8102e", codes: [], provenance: "user-edited" }, { id: "colour-2", role: "Second colour", screen: "#ffffff", codes: [], provenance: "user-edited" }],
    colourways: [{ id: "as-read", name: "True", colours: {} }],
    layers: [
      { ...common, id: "ground", kind: "ground", views: ["front"], colourId: "colour-1" },
      { ...common, id: "hoops", kind: "pattern", views: ["front"], generatorId: "kit-hoops", params: { bandWidthMm: 40 }, datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } }, colourIds: ["colour-2"] },
      { ...common, id: "number", kind: "player-mark", views: ["front"], place: "front-number", style: "block", heightMm: 85.9, colourId: "colour-2" },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.stack;
}

/** Mean colour difference between two flattened art pictures, over the pixels both show, with transparent pixels read as white paper. */
async function meanDelta(a: Uint8Array, b: Uint8Array): Promise<number> {
  const [x, y] = await Promise.all([a, b].map((png) => sharp(png).flatten({ background: "#ffffff" }).resize(60, 60, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true })));
  const hex = (d: Buffer, i: number): string => `#${[0, 1, 2].map((k) => d[i + k]!.toString(16).padStart(2, "0")).join("")}`;
  let total = 0;
  const count = x!.info.width * x!.info.height;
  for (let at = 0; at < count; at += 1) total += deltaE(hex(x!.data, at * x!.info.channels), hex(y!.data, at * y!.info.channels));
  return total / count;
}

describe("case 5: a design read from a picture", () => {
  it("prints from W7d's real output, and every file in every size carries the picture note", async () => {
    const world = await realWorld();
    const { stack } = await derivedStack(world, false);
    expect(stack.layers.every((l) => l.provenance === "read-from-image")).toBe(true);
    const builder = world.builder(stack);
    for (const size of world.pattern.sizes) {
      for (const placed of builder.mapper.placed(size)) {
        const file = await builder.buildFile(specOf(placed.instance.id, size, "svg"));
        expect(file.scene.scene.noteLines, `${size} ${placed.instance.id}`).toContain(PICTURE_NOTE);
      }
    }
  }, 240_000);

  it(`is within a mean colour difference of ${MEAN_DELTA_E_LIMIT} of the true print`, async () => {
    const world = await realWorld();
    const { stack } = await derivedStack(world, false);
    for (const size of ["S", "L"]) {
      const [got, want] = await Promise.all([stack, trueStack()].map(async (s) => flattenScene((await world.builder(s, { colourwayId: s.colourways[0]!.id }).buildFile(specOf("front", size, "svg"))).scene.scene, { dpi: 20 })));
      const distance = await meanDelta(got!.png, want!.png);
      expect(distance, `size ${size}`).toBeLessThan(MEAN_DELTA_E_LIMIT);
    }
  }, 240_000);

  it("prints the crest from the artwork the intake kept, and leaves the picture's pixels out of any other file", async () => {
    const world = await realWorld();
    const { stack } = await derivedStack(world, true);
    const front = await world.builder(stack).buildFile(specOf("front", "M", "svg"));
    expect(front.scene.scene.items.some((i) => i.kind === "image" && i.layerId === "mark-2")).toBe(true);
    expect(front.scene.scene.issues.some((i) => /not available/.test(i.text))).toBe(false);
  }, 240_000);
});
