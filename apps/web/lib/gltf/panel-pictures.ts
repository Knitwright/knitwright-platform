import sharp from "sharp";
import type { ArtworkStack, AssetReader, PatternGenerator } from "@/lib/artwork-stack";
import { createPrintFileBuilder } from "@/lib/print/build/file-builder";
import { planPrintFiles } from "@/lib/print/build/plan";
import { defaultsNoteFor, SHRINK_NOT_APPLIED } from "@/lib/print/inputs/notes";
import { flattenScene } from "@/lib/print/render/raster";
import { artItems, buildSvg, type SvgView } from "@/lib/print/render/svg";
import { pageSizeMm, type PieceScene } from "@/lib/print/scene";
import type { GradedPattern, PrintProfile, PrintRuleSet } from "@/lib/production/contract";
import type { PanelLayout } from "./layout";

/*
 * Principle 3, "the texture is the print file" (spec 01; plan v6 D3, decision 0134).
 *
 * The 3D view's atlas is painted with the art of the print files and nothing else. Each panel's
 * print file is planned and built exactly as the download builds it (`planPrintFiles` and
 * `createPrintFileBuilder`, as in `lib/print/service.ts`), and the panel picture is that file's art,
 * cut to the piece's cut box and drawn at the pixel size of the panel's island. The guides, the bleed
 * and the margin note are left off: they are on the paper, not on the garment.
 *
 * Server only: the print path reads artwork and draws with sharp. This file is not exported from
 * `lib/gltf/index.ts`, which the browser loads; the editor reaches it through `./actions.ts`.
 */

export interface PanelPictureInput {
  /** The pattern the layout was built from, so every picture lands on its own island. */
  readonly pattern: GradedPattern;
  readonly layout: PanelLayout;
  readonly stack: ArtworkStack;
  readonly colourwayId: string;
  /** The garment type, which picks the print zones. */
  readonly garment: string;
  readonly profile: PrintProfile;
  readonly rules: PrintRuleSet;
  readonly assets: AssetReader;
  readonly generators?: readonly PatternGenerator[];
}

export interface PanelPicture {
  /** The art of the panel's print file, cut to the cut box, at the island's pixel size. */
  readonly svg: string;
  readonly png: Uint8Array;
}

/** The pixel size of a panel's island in the atlas. */
const islandPixels = (layout: PanelLayout, id: string): { width: number; height: number } => {
  const panel = layout.panels.find((one) => one.id === id);
  if (!panel) throw new RangeError(`The layout has no panel ${id}.`);
  return {
    width: Math.max(1, Math.round((panel.rect.u1 - panel.rect.u0) * layout.textureSize)),
    height: Math.max(1, Math.round((panel.rect.v1 - panel.rect.v0) * layout.textureSize)),
  };
};

/**
 * The art of a print scene, windowed on its cut box and stretched to the given pixels. The art group
 * is written by the same function as the print file's, so for a scene with no blending layer it is the
 * same text. A blending scene is flattened at the atlas's own resolution rather than the print's.
 */
export async function panelArtSvg(scene: PieceScene, widthPx: number, heightPx: number): Promise<string> {
  const page = pageSizeMm(scene);
  const width = page.width - 2 * scene.bleedMm;
  const height = page.height - 2 * scene.bleedMm;
  const dpi = Math.max(1, Math.ceil((widthPx / width) * 25.4));
  const flat = scene.raster ? await flattenScene(scene, { dpi }) : undefined;
  const view: SvgView = { x: scene.bleedMm, y: scene.bleedMm, width, height, widthAttr: String(widthPx), heightAttr: String(heightPx), places: 2, keepAspect: false };
  return buildSvg(scene, view, { items: artItems(scene, flat), background: null, art: true, guides: false, margin: false, meta: false, forceNormal: false });
}

/** The `<g id="art">` element of an SVG this pipeline wrote, for comparing a picture with its print file. */
export function artGroupOf(svg: string): string {
  const start = svg.indexOf('<g id="art"');
  const end = svg.indexOf("</g>\n", start);
  if (start < 0 || end < 0) throw new RangeError("The SVG has no art group.");
  return svg.slice(start, end + "</g>".length);
}

/** Every panel of the layout, painted from its print file. Deterministic: the same design gives the same bytes. */
export async function panelPictures(input: PanelPictureInput): Promise<Record<string, PanelPicture>> {
  const { profile, layout } = input;
  const plan = planPrintFiles({ pattern: input.pattern, stack: input.stack, sizes: [layout.size], formats: ["svg"], profile, roster: null });
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
    ...(input.generators ? { generators: input.generators } : {}),
  });
  const ids = new Set(layout.panels.map((panel) => panel.id as string));
  const entries = plan.entries.filter((entry) => ids.has(entry.spec.pieceId) && !entry.player && !entry.transferOnly);
  const painted = await Promise.all(
    entries.map(async (entry): Promise<[string, PanelPicture]> => {
      const { scene } = await builder.buildFile(entry.spec);
      const pixels = islandPixels(layout, entry.spec.pieceId);
      const svg = await panelArtSvg(scene.scene, pixels.width, pixels.height);
      const png = await sharp(Buffer.from(svg)).resize(pixels.width, pixels.height, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();
      return [entry.spec.pieceId, { svg, png: new Uint8Array(png) }];
    }),
  );
  return Object.fromEntries(painted);
}

/** The picture addresses `ModelViewer` takes, by panel id. */
export const picturesForViewer = (pictures: Readonly<Record<string, PanelPicture>>): Record<string, string> =>
  Object.fromEntries(Object.entries(pictures).map(([id, picture]) => [id, `data:image/png;base64,${Buffer.from(picture.png).toString("base64")}`]));
