import type { Layer, StackColour, ViewId } from "@/lib/artwork-stack";
import type { Raster } from "./raster";

/**
 * Step 7, the all-over pattern stage, behind an interface. The real one needs W7b's `findRepeat` and W7c's
 * generator registry (phase B). Here it is an interface with a "not read yet" stage and a fake, so the rest of the
 * pipeline is built and tested against the shape it will take.
 *
 * The stage gets the garment flattened into design space (the picture warped by the fit) with the marks repaired
 * from their neighbours. It returns a proposal or null. A proposal's repeat size is taken from its proportion to
 * the garment width, so it is always labelled "estimated, check it".
 */

export interface PatternInput {
  readonly view: ViewId;
  /** The view, flattened into design space at `stepMm` per pixel. */
  readonly flat: Raster;
  readonly stepMm: number;
  readonly colours: readonly StackColour[];
}

export interface RepeatEstimate {
  readonly widthMm: number;
  readonly heightMm: number;
  /** Always "estimated, check it". */
  readonly label: string;
}

export const REPEAT_LABEL = "estimated, check it";

export interface PatternProposal {
  /** A `pattern` layer when a generator fits within the error limit, else an `image-fill`. */
  readonly layer: Layer;
  readonly kind: "generator" | "tile" | "panel";
  readonly confidence: number;
  readonly note: string;
  readonly repeat: RepeatEstimate | null;
  /** The tile kept as the alternative when a generator was proposed. */
  readonly alternative: Layer | null;
  /** Effective resolution of an image fill, in dots per inch, when there is one. */
  readonly effectiveDpi: number | null;
}

export interface PatternStage {
  /** False for the stage that does not read patterns yet. */
  readonly reads: boolean;
  find(input: PatternInput): Promise<PatternProposal | null>;
}

export const PATTERN_NOT_READ_YET =
  "All-over patterns are not read yet. If your design has one, add it from the pattern list after you accept.";

/** The stage used until W7b and W7c are on main. */
export const pendingPatternStage: PatternStage = { reads: false, find: async () => null };

/** Dots per inch for a picture of `pixels` across `mm` of fabric. */
export const effectiveDpi = (pixels: number, mm: number): number => Math.round((pixels / (mm / 25.4)) * 10) / 10;

/** The print house minimum is not known (open item P14); this is Knitwright's default and is labelled so. */
export const DPI_WARNING_BELOW = 150;

export const dpiWarning = (dpi: number): string | null =>
  dpi < DPI_WARNING_BELOW
    ? `The picture is too small to print this pattern sharply: about ${Math.round(dpi)} dots per inch where ${DPI_WARNING_BELOW} is the Knitwright default, not from your print house.`
    : null;
