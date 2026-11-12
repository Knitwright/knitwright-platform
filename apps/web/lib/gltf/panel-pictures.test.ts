import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createFakeAssetReader } from "@/lib/artwork-stack";
import { draftForEditor, modelForDraft } from "@/lib/editor/draft";
import { defaultForm } from "@/lib/editor/form";
import { jersey } from "@/lib/editor/fixtures/article";
import { toGradedPattern } from "@/lib/parametric";
import { createPrintFileBuilder } from "@/lib/print/build/file-builder";
import { planPrintFiles } from "@/lib/print/build/plan";
import { NO_RULES } from "@/lib/print/fixtures/setup";
import { polkaStack } from "@/lib/print/fixtures/stacks";
import { defaultsNoteFor, SHRINK_NOT_APPLIED } from "@/lib/print/inputs/notes";
import { DEFAULT_PRINT_PROFILE } from "@/lib/print/profiles";
import { atlasPlan } from "./viewer";
import { artGroupOf, panelPictures, picturesForViewer, type PanelPictureInput } from "./panel-pictures";

/**
 * Principle 3, "the texture is the print file" (plan v6 D3, decision 0134). The fixture design is the
 * worked jersey JSY-SS-01, drafted in size M, with the benchmark polka-dot stack. The pictures the 3D
 * view paints into its atlas must be the art of the very print files a person downloads.
 */

const SIZE = "M";

function fixture(): PanelPictureInput {
  const draft = draftForEditor("JSY-SS-01", SIZE, defaultForm(jersey()));
  if (draft?.kind !== "drafted") throw new Error("JSY-SS-01 should draft in size M.");
  const model = modelForDraft(draft);
  if (!model) throw new Error("JSY-SS-01 should have a model.");
  return {
    pattern: toGradedPattern([draft.draft], 1),
    layout: model.layout,
    stack: polkaStack(),
    colourwayId: "main",
    garment: "jersey",
    profile: DEFAULT_PRINT_PROFILE,
    rules: NO_RULES,
    assets: createFakeAssetReader([]),
  };
}

/** The print files exactly as the download makes them (`servePrintFiles`): planned, then built, one SVG per piece. */
async function printFilesOf(input: PanelPictureInput): Promise<Map<string, string>> {
  const { profile } = input;
  const plan = planPrintFiles({ pattern: input.pattern, stack: input.stack, sizes: [SIZE], formats: ["svg"], profile, roster: null });
  const builder = createPrintFileBuilder({
    pattern: input.pattern,
    stack: input.stack,
    colourwayId: input.colourwayId,
    assets: input.assets,
    rules: input.rules,
    roster: null,
    garment: input.garment,
    minDpi: profile.minDpi,
    scaleNote: SHRINK_NOT_APPLIED,
    defaultsNote: defaultsNoteFor(profile),
    patternReviewed: false,
  });
  const files = new Map<string, string>();
  for (const entry of plan.entries) files.set(entry.spec.pieceId, new TextDecoder().decode((await builder.buildFile(entry.spec)).bytes));
  return files;
}

describe("panelPictures", () => {
  it("gives the atlas one picture for every panel of the model, and nothing else", async () => {
    const input = fixture();
    const pictures = await panelPictures(input);

    expect(Object.keys(pictures).sort()).toEqual(input.layout.panels.map((panel) => panel.id).sort());
    expect(atlasPlan(input.layout, Object.keys(pictures)).draws.map((draw) => draw.panelId)).toEqual(input.layout.panels.map((panel) => panel.id));
  });

  it("paints each panel with the art of that panel's print file, byte for byte", async () => {
    const input = fixture();
    const [pictures, files] = await Promise.all([panelPictures(input), printFilesOf(input)]);

    for (const panel of input.layout.panels) {
      const file = files.get(panel.id);
      const picture = pictures[panel.id];
      expect(file, panel.id).toBeDefined();
      expect(picture, panel.id).toBeDefined();
      const printed = artGroupOf(file as string);
      expect(printed.length, panel.id).toBeGreaterThan(100);
      expect(artGroupOf(picture?.svg as string), panel.id).toBe(printed);
    }
  });

  it("draws each picture at the pixel size of its island, with no guides and no margin note", async () => {
    const input = fixture();
    const pictures = await panelPictures(input);

    for (const panel of input.layout.panels) {
      const picture = pictures[panel.id];
      const meta = await sharp(picture?.png).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(Math.max(1, Math.round((panel.rect.u1 - panel.rect.u0) * input.layout.textureSize)));
      expect(meta.height).toBe(Math.max(1, Math.round((panel.rect.v1 - panel.rect.v0) * input.layout.textureSize)));
      expect(picture?.svg).not.toContain('id="guides"');
      expect(picture?.svg).not.toContain('id="margin"');
    }
  });

  it("shows the design's own colours, not a blank island", async () => {
    const pictures = await panelPictures(fixture());
    const { data, info } = await sharp(pictures.front?.png).raw().toBuffer({ resolveWithObject: true });
    const pixels = new Set<string>();
    for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] === 255) pixels.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);

    expect(pixels.has("204,34,34")).toBe(true);
    expect(pixels.has("34,85,170")).toBe(true);
  });

  it("is the same pictures for the same design", async () => {
    const one = await panelPictures(fixture());
    const two = await panelPictures(fixture());

    for (const id of Object.keys(one)) expect(Buffer.from(one[id]?.png as Uint8Array).equals(Buffer.from(two[id]?.png as Uint8Array))).toBe(true);
  });

  it("hands the viewer a PNG address for each panel, made from those bytes", async () => {
    const pictures = await panelPictures(fixture());
    const forViewer = picturesForViewer(pictures);

    for (const [id, picture] of Object.entries(pictures)) {
      expect(forViewer[id]).toBe(`data:image/png;base64,${Buffer.from(picture.png).toString("base64")}`);
    }
  });
});
