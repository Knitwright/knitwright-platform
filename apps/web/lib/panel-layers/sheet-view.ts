import type { BoundsMm, PatternSheet, RulerTick, SheetPiece } from "./sheet";

/**
 * The few sums the 2D view needs to put millimetres on a screen (plan v5 Y3, decision 0076). They
 * live here, not in the canvas file, so the drawing is tested without a browser: the canvas file
 * only hands Fabric the shapes these give it.
 */

/** How many device pixels one millimetre is drawn at, for a canvas this wide. */
export function zoomFor(bounds: BoundsMm, widthPx: number): number {
  const width = bounds.maxX - bounds.minX;
  if (width <= 0 || widthPx <= 0) return 1;
  return widthPx / width;
}

/** The height a canvas needs to show the whole sheet at this width. */
export const heightFor = (bounds: BoundsMm, widthPx: number): number => Math.max(1, Math.round((bounds.maxY - bounds.minY) * zoomFor(bounds, widthPx)));

/** Where a ruler mark sits along the canvas, in device pixels from its left or top edge. */
export const tickAt = (tick: RulerTick, from: number, zoom: number): number => Math.round((tick.mm - from) * zoom * 100) / 100;

/** The dotted grid as a background: how far apart the dots are on screen. Under 4 px the grid is not drawn. */
export function gridStep(sheet: PatternSheet, widthPx: number): number | null {
  const px = sheet.grid.mm * zoomFor(sheet.boundsMm, widthPx);
  return px < 4 ? null : Math.round(px * 100) / 100;
}

/** The scale bar's length on screen, which is its own millimetres at this zoom. */
export const scaleBarPx = (sheet: PatternSheet, widthPx: number): number => Math.round(sheet.scaleBar.mm * zoomFor(sheet.boundsMm, widthPx) * 100) / 100;

/** One piece in words, for the keyboard and screen-reader path: a canvas is neither (decision 0053). */
export function pieceSummary(piece: SheetPiece): string {
  const cut = piece.rings.find((ring) => ring.kind === "cut");
  const size = cut === undefined ? "no outline on file" : sizeOf(cut.points);
  const lines = piece.rings.map((ring) => ring.kind).join(", ");
  return `${piece.name}, size ${piece.sizeLabel}. ${size}. Lines drawn: ${lines}.`;
}

function sizeOf(points: readonly (readonly [number, number])[]): string {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return `${Math.round(Math.max(...xs) - Math.min(...xs))} by ${Math.round(Math.max(...ys) - Math.min(...ys))} mm`;
}
