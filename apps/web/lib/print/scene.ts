import type { Blend } from "@/lib/artwork-stack";
import type { Affine } from "./geometry/affine";

/**
 * What the layout builds and the renderers draw. It knows nothing about which kind of design made it:
 * a kit style, a generator, a club's picture and a design read from a picture all end up as these items.
 *
 * Coordinates: millimetres in the piece's own plane after the shrink scale (the "page plane"), y up, as the
 * pattern file is. A ring is a closed run of points; the first point is not repeated at the end.
 * Colours are `#rrggbb` screen colours. Every item belongs to one stack layer, in blend order.
 */
export type Ring = readonly (readonly [number, number])[];

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Filled shapes. Several rings are filled together with the even-odd rule, so a ring inside another is a hole. */
export interface FillItem {
  readonly kind: "fill";
  readonly layerId: string;
  readonly rings: readonly Ring[];
  readonly colour: string;
  readonly opacity: number;
  readonly blend: Blend;
}

/** A line of fixed width, open or closed. */
export interface StrokeItem {
  readonly kind: "stroke";
  readonly layerId: string;
  readonly points: Ring;
  readonly closed: boolean;
  readonly widthMm: number;
  readonly colour: string;
  readonly opacity: number;
  readonly blend: Blend;
}

/**
 * A picture. `png` is a PNG of pixels only (RGBA, 8 bit), already resampled once to the print resolution.
 * `matrix` maps the picture's pixel space (x right, y down, 0..widthPx and 0..heightPx) to the page plane.
 * The picture shows only inside `clip` (even-odd), which is the bleed outline with any knocked-out holes.
 * Many items may share one `imageId` (a repeating tile); the renderers write the pixels once.
 */
export interface ImageItem {
  readonly kind: "image";
  readonly layerId: string;
  readonly imageId: string;
  readonly png: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly matrix: Affine;
  readonly clip: readonly Ring[];
  readonly opacity: number;
  readonly blend: Blend;
}

export type SceneItem = FillItem | StrokeItem | ImageItem;

/** How serious a note on a file is. A "stop" means the file should not go to the printer as it is. */
export type IssueSeverity = "stop" | "warn" | "note";

export interface PrintIssue {
  readonly severity: IssueSeverity;
  readonly text: string;
}

export interface PieceScene {
  /** The piece as printed: front, back, sleeve-left, sleeve-right or collar. */
  readonly instanceId: string;
  readonly pieceName: string;
  readonly size: string;
  /** The player this file is for, as shown on it, or null. */
  readonly playerLabel: string | null;
  /** The cut line after the shrink scale, opened out when the piece is cut on the fold. */
  readonly cut: Ring;
  /** The cut line grown by the bleed. */
  readonly bleed: Ring;
  readonly bleedMm: number;
  /** The page is this box grown by the bleed on every side. */
  readonly cutBox: Box;
  readonly dpi: number;
  /** Drawn in order, clipped to the bleed outline. */
  readonly items: readonly SceneItem[];
  /** Drawn last, never clipped: the margin note, as outlines. */
  readonly margin: readonly FillItem[];
  /** Set when a layer blends pixels: the renderers write this piece as one picture. */
  readonly raster: { readonly reason: string } | null;
  /** The notes in words, also written into the file's own description. */
  readonly noteLines: readonly string[];
  readonly issues: readonly PrintIssue[];
}

export const pageSizeMm = (scene: Pick<PieceScene, "cutBox" | "bleedMm">): { readonly width: number; readonly height: number } => ({
  width: scene.cutBox.maxX - scene.cutBox.minX + 2 * scene.bleedMm,
  height: scene.cutBox.maxY - scene.cutBox.minY + 2 * scene.bleedMm,
});
