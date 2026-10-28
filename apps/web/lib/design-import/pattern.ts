import type { Layer, StackColour, ViewId } from "@/lib/artwork-stack";
import { dpiWarning as intakeDpiWarning } from "@/lib/artwork-intake";
import type { Raster } from "./raster";

/**
 * Step 7, the all-over pattern stage, behind an interface. The real stage is `match/stage.ts` (W7b's `findRepeat`
 * and W7c's generators); a fake can stand in for tests of the rest of the pipeline.
 *
 * The stage gets the garment flattened into design space (the picture warped by the fit) with the marks repaired
 * from their neighbours. It returns a proposal or null. A proposal's repeat size is taken from its proportion to
 * the garment width, so it is always labelled "estimated, check it".
 */

export interface PatternInput {
  readonly view: ViewId;
  /** The view, flattened into design space at `stepMm` per pixel. */
  readonly flat: Raster;
  /** 255 on the garment, 0 off it, one byte for each pixel of `flat`. */
  readonly mask: Uint8Array;
  readonly stepMm: number;
  /** Design millimetres of the flat's top left corner. */
  readonly originMm: { readonly x: number; readonly y: number };
  /** Where a zero offset puts the repeat datum on this view, in design millimetres. */
  readonly datumMm: { readonly x: number; readonly y: number };
  /** Pixels of the picture as it was sent, for each millimetre of fabric. This sets the sharpness of a picture fill. */
  readonly sourcePxPerMm: number;
  readonly colours: readonly StackColour[];
}

export interface RepeatEstimate {
  /** Null along an axis the pattern does not repeat on, such as the length of a vertical stripe. */
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  /** Always "estimated, check it". */
  readonly label: string;
}

export const REPEAT_LABEL = "estimated, check it";

/** A picture to cut from the original for an `image-fill` layer: the part of the garment in design millimetres. */
export interface PictureCut {
  /** The asset id the layer names until the picture is stored. */
  readonly assetId: string;
  readonly view: ViewId;
  readonly area: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  /** Whether pixels off the garment are cut away (a full-panel picture) or the cut is a plain block (a tile). */
  readonly clip: boolean;
}

export interface MatchSummary {
  /** The generator that scored best, whether or not it was proposed. */
  readonly generatorId: string | null;
  /** The share of pixels that differ from the picture, 0 to 1. */
  readonly error: number | null;
  readonly limit: number;
}

export interface PatternProposal {
  /** A `pattern` layer when a generator fits within the error limit, else an `image-fill`. */
  readonly layer: Layer;
  readonly kind: "generator" | "tile" | "panel";
  readonly confidence: number;
  readonly note: string;
  readonly repeat: RepeatEstimate | null;
  /** The tile kept as the alternative when a generator was proposed. It is not drawn until the person chooses it. */
  readonly alternative: Layer | null;
  /** Pictures to cut for the layer and its alternative. */
  readonly cuts: readonly PictureCut[];
  /** Effective resolution of a picture fill, in dots per inch, when there is one. */
  readonly effectiveDpi: number | null;
  /** W7b's warning for that resolution, or null. */
  readonly dpiWarning: string | null;
  readonly match: MatchSummary;
}

export interface PatternStage {
  /** False for a stage that does not read patterns. */
  readonly reads: boolean;
  find(input: PatternInput): Promise<PatternProposal | null>;
}

export const PATTERN_NOT_READ_YET =
  "All-over patterns are not read yet. If your design has one, add it from the pattern list after you accept.";

/** A stage that reads nothing, for tests of the rest of the pipeline. */
export const pendingPatternStage: PatternStage = { reads: false, find: async () => null };

const MM_PER_INCH = 25.4;

/** Dots per inch for a picture of `pixels` across `mm` of fabric. */
export const effectiveDpi = (pixels: number, mm: number): number => Math.round((pixels / (mm / MM_PER_INCH)) * 10) / 10;

const DPI_SOURCE_NOTE = "The 150 dots per inch is Knitwright's default, not from your print house.";

/** W7b's warning for a raster of `widthPx` printed `widthMm` wide, or null, with where the minimum comes from. */
export function dpiWarning(widthPx: number, widthMm: number): string | null {
  const warning = intakeDpiWarning({ kind: "raster", widthPx }, widthMm);
  return warning === null ? null : `${warning} ${DPI_SOURCE_NOTE}`;
}
