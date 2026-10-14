import type { Blend, ViewId } from "@/lib/artwork-stack";
import type { Box, Pt } from "../geometry/vec";
import type { Shape } from "../geometry/boolean";

/** Pieces are in print space: the pattern's millimetres (y up, as the pattern file has them) after the shrink scale. */

export interface FilledShape {
  readonly shape: Shape;
  readonly fill: string;
}

/** Vector artwork of one stack layer. Normal and knock-out blends stay vector. */
export interface VectorLayer {
  readonly kind: "vector";
  readonly layerId: string;
  readonly opacity: number;
  readonly blend: Blend;
  readonly shapes: readonly FilledShape[];
}

/** One horizontal slice of a picture layer, already at the file's resolution. */
export interface RasterStrip {
  readonly box: Box;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly png: Uint8Array;
}

/** Picture artwork of one stack layer, or the whole piece when a blend needed pixels. */
export interface RasterLayer {
  readonly kind: "raster";
  readonly layerId: string;
  readonly opacity: number;
  readonly blend: Blend;
  readonly dpi: number;
  readonly strips: readonly RasterStrip[];
}

export type SceneLayer = VectorLayer | RasterLayer;

export const ISSUE_CODES = [
  "below-min-dpi",
  "name-does-not-fit",
  "number-does-not-fit",
  "outside-zones",
  "larger-than-zone",
  "not-placed",
  "missing-glyph",
  "rule",
  "colour-avoid",
  "shape-budget",
  "dpi-lowered",
  "asset-missing",
  "pattern-missing",
  "no-colour",
  "no-ground",
  "text-too-small",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

/** Something unmet, in plain words, with a code so code can tell what it is. */
export interface Issue {
  readonly code: IssueCode;
  readonly text: string;
  /** The stack layer it is about, when there is one. */
  readonly layerId?: string;
}

export interface PlayerTag {
  readonly name: string;
  readonly number: string;
}

/** Everything a renderer needs to draw one file, with nothing it has to work out about what kind of design this is. */
export interface PieceScene {
  readonly pieceId: string;
  readonly pieceName: string;
  readonly view: ViewId;
  /** The pattern size this piece is cut from. */
  readonly size: string;
  /** The label the person sees (M, 2XL), when the file is for a label. */
  readonly sizeLabel: string | null;
  readonly player: PlayerTag | null;
  readonly cutOutline: readonly Pt[];
  readonly bleedOutline: readonly Pt[];
  /** The page: the piece's bounds plus the bleed on every side. */
  readonly box: Box;
  readonly bleedMm: number;
  readonly dpi: number;
  readonly scale: { readonly length: number; readonly width: number };
  readonly layers: readonly SceneLayer[];
  /** Lines for the margin of the file, one fact each. */
  readonly notes: readonly string[];
  /** Anything unmet, in plain sentences; also returned in the file's result. */
  readonly issues: readonly Issue[];
  /** The lowest effective resolution of any picture on the piece, or null when there is none. */
  readonly lowestDpi: number | null;
  /** True when a blend turned the whole piece into pixels. */
  readonly flattened: boolean;
  /** Artwork that is the name and number alone, with no ground (the transfer set). */
  readonly transferOnly: boolean;
}

export const hasRaster = (scene: Pick<PieceScene, "layers">): boolean => scene.layers.some((l) => l.kind === "raster");
