import type { Box } from "../geometry/vec";

/** Pixels per strip: a stated memory budget. One strip holds at most this many pixels, at four bytes a pixel. */
export const STRIP_PIXEL_BUDGET = 6_000_000;
/** The most pixels one file may have. Over it, the resolution drops and the file says so. */
export const MAX_FILE_PIXELS = 120_000_000;

export interface PixelGrid {
  readonly widthPx: number;
  readonly heightPx: number;
  /** Pixels per millimetre across and down. Near the stated resolution; exactly fit to the page. */
  readonly pxPerMmX: number;
  readonly pxPerMmY: number;
  readonly dpi: number;
}

export interface Strip {
  readonly index: number;
  /** In the piece's own millimetres (y up). */
  readonly box: Box;
  readonly widthPx: number;
  readonly heightPx: number;
  /** First pixel row of the strip in the page. */
  readonly row: number;
}

/**
 * The resolution a page is printed at: the profile's, or lower when the page would have more pixels than a file may.
 * The second value says whether it was lowered.
 */
export function fileDpiFor(box: Box, wantedDpi: number, maxPixels: number = MAX_FILE_PIXELS): { dpi: number; lowered: boolean } {
  const [w, h] = [(box.maxX - box.minX) / 25.4, (box.maxY - box.minY) / 25.4];
  const wanted = w * wantedDpi * (h * wantedDpi);
  if (wanted <= maxPixels) return { dpi: wantedDpi, lowered: false };
  return { dpi: Math.max(1, Math.floor(Math.sqrt(maxPixels / (w * h)))), lowered: true };
}

export function pixelGrid(box: Box, dpi: number): PixelGrid {
  const [w, h] = [box.maxX - box.minX, box.maxY - box.minY];
  const widthPx = Math.max(1, Math.round((w / 25.4) * dpi));
  const heightPx = Math.max(1, Math.round((h / 25.4) * dpi));
  return { widthPx, heightPx, pxPerMmX: widthPx / w, pxPerMmY: heightPx / h, dpi };
}

/** The page cut into full-width strips from the top, each within the pixel budget. Deterministic. */
export function stripsOf(box: Box, grid: PixelGrid, budget: number = STRIP_PIXEL_BUDGET): Strip[] {
  const rows = Math.max(1, Math.floor(budget / grid.widthPx));
  const strips: Strip[] = [];
  for (let row = 0, index = 0; row < grid.heightPx; row += rows, index += 1) {
    const end = Math.min(grid.heightPx, row + rows);
    strips.push({
      index,
      row,
      widthPx: grid.widthPx,
      heightPx: end - row,
      box: { minX: box.minX, maxX: box.maxX, maxY: box.maxY - row / grid.pxPerMmY, minY: box.maxY - end / grid.pxPerMmY },
    });
  }
  return strips;
}
