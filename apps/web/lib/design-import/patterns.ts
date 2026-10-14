import type { Layer, StackColour, ViewId } from "@/lib/artwork-stack";
import { cutPicture, maskRaster, type PictureFile } from "./cuts";
import { toDesign, warpToDesign, type ViewFit } from "./fit";
import { markRect, repairGround } from "./marks";
import type { PatternProposal, PatternStage } from "./pattern";
import { decodeRaster, type Raster } from "./raster";
import type { ReadMark } from "./read";
import type { LandmarkTemplate } from "./template";
import type { ViewAnalysis } from "./views";

/** Runs the all-over pattern stage for each fitted view and cuts the pictures its proposals need, at the original's own sharpness. */

/** The longest side of the copy the pictures are cut from. */
export const SOURCE_SIDE = 1600;
/** A flat for the stage is this many pixels across. */
const FLAT_ACROSS = 300;

export interface FoundPatterns {
  readonly proposals: readonly PatternProposal[];
  readonly pictures: readonly PictureFile[];
  /** Layers in drawing order: each proposal, then its alternative. */
  readonly layers: readonly Layer[];
}

export interface PatternRun {
  readonly stage: PatternStage;
  readonly template: LandmarkTemplate;
  /** The picture the analysis ran on, with the marks repaired from their neighbours. */
  readonly repaired: Raster;
  readonly source: SourceCopy;
  /** True when the analysis picture is an image model's clean-up: its pixels are generated, and are all there is. */
  readonly generated: boolean;
  readonly marks: readonly ReadMark[];
  readonly analyses: readonly ViewAnalysis[];
  readonly fits: ReadonlyMap<ViewId, ViewFit>;
  readonly colours: readonly StackColour[];
}

const NONE: FoundPatterns = { proposals: [], pictures: [], layers: [] };

/** The picture at its best resolution, and how many of its pixels there are for each pixel of the analysis copy. */
export interface SourceCopy {
  readonly raster: Raster;
  readonly scale: number;
}

/** A clean-up's pixels are all there is of a generated picture, so its source is the analysis copy itself. */
export async function sourceCopy(bytes: Uint8Array, analysis: Raster, generated: boolean): Promise<SourceCopy> {
  if (generated) return { raster: analysis, scale: 1 };
  const raster = await decodeRaster(bytes, SOURCE_SIDE);
  return { raster, scale: raster.width / analysis.width };
}

/** A picture fill printed at the size its picture was cut at. */
const scaledLayer = (layer: Layer, pictures: readonly PictureFile[]): Layer => {
  const picture = layer.kind === "image-fill" ? pictures.find((p) => p.assetId === layer.assetId) : undefined;
  return picture && layer.kind === "image-fill" ? { ...layer, scale: picture.scale } : layer;
};

const scaled = (proposal: PatternProposal, pictures: readonly PictureFile[]): PatternProposal => ({
  ...proposal,
  layer: scaledLayer(proposal.layer, pictures),
  alternative: proposal.alternative === null ? null : scaledLayer(proposal.alternative, pictures),
});

export async function findPatterns(run: PatternRun): Promise<FoundPatterns> {
  if (!run.stage.reads) return NONE;
  const { source } = run;
  const hi = run.generated ? run.repaired : repairGround(source.raster, run.marks.filter((m) => run.fits.has(m.view)).map((m) => markRect(m, source.raster)));
  const proposals: PatternProposal[] = [];
  const pictures: PictureFile[] = [];
  for (const analysis of run.analyses) {
    const fit = run.fits.get(analysis.view);
    if (!fit) continue;
    const design = analysis.outline.polygon.map((p) => toDesign(fit, p));
    const area = { minX: Math.min(...design.map((p) => p.x)), minY: Math.min(...design.map((p) => p.y)), maxX: Math.max(...design.map((p) => p.x)), maxY: Math.max(...design.map((p) => p.y)) };
    const stepMm = Math.max(1, (area.maxX - area.minX) / FLAT_ACROSS);
    const mask = maskRaster(analysis.outline.mask, run.repaired.width, run.repaired.height);
    const flatMask = warpToDesign(mask, fit, area, stepMm);
    const flat = warpToDesign(run.repaired, fit, area, stepMm);
    const proposal = await run.stage.find({
      view: analysis.view,
      flat,
      mask: Uint8Array.from({ length: flat.width * flat.height }, (_, at) => (flatMask.data[at * 4] > 127 && flatMask.data[at * 4 + 3] > 0 ? 255 : 0)),
      stepMm,
      originMm: { x: area.minX, y: area.minY },
      datumMm: { x: 0, y: run.template.landmarks(analysis.view).underarm?.y ?? 0 },
      sourcePxPerMm: source.scale / fit.mmPerPixel,
      colours: run.colours,
    });
    if (!proposal) continue;
    const cut = await Promise.all(proposal.cuts.map((c) => cutPicture(c, { raster: hi, scale: source.scale, fit, mask, generated: run.generated })));
    pictures.push(...cut);
    proposals.push(scaled(proposal, cut));
  }
  return { proposals, pictures, layers: proposals.flatMap((p) => (p.alternative ? [p.layer, p.alternative] : [p.layer])) };
}
