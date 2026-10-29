import { bbox } from "../geometry";
import { isFoldedRib, type ArticleDraft, type DraftPiece } from "../types";

/** Sheet spacing of the reference files, in mm. */
export const GAP = 50;
export const MARGIN = 30;

/** Where one piece sits on a size's sheet, with its grain line and label (the script's per-piece block). */
export type PlacedPiece = Readonly<{
  piece: DraftPiece;
  ox: number;
  oy: number;
  grain: Readonly<{ x: number; y0: number; y1: number }>;
  label: Readonly<{ x: number; y: number; lines: readonly string[] }>;
}>;

export type Sheet = Readonly<{ pieces: readonly PlacedPiece[]; width: number; height: number }>;

/** The five label lines printed on every piece. */
export const labelLines = (draft: ArticleDraft, piece: DraftPiece): string[] => [
  `${draft.articleCode} v${draft.articleVersion}`,
  piece.label,
  `Size ${draft.size}`,
  `Cut ${piece.cut} - ${piece.fabricCode}`,
  "Grain: vertical",
];

function place(draft: ArticleDraft, piece: DraftPiece, x: number): PlacedPiece & { w: number; hgt: number } {
  const bb = bbox(piece.cutLine);
  const w = bb.x1 - bb.x0;
  const hgt = bb.y1 - bb.y0;
  const rib = isFoldedRib(piece);
  const grain = rib
    ? { x: x + 30, y0: MARGIN + 4, y1: MARGIN + hgt - 4 }
    : { x: x + w / 2, y0: MARGIN + hgt * 0.3, y1: MARGIN + hgt * 0.8 };
  const label = { x: x + w / 2, y: rib ? MARGIN + hgt + 12 : MARGIN + hgt * 0.42, lines: labelLines(draft, piece) };
  return { piece, ox: x - bb.x0, oy: MARGIN - bb.y0, grain, label, w, hgt };
}

/** Pieces side by side on one row, in draft order, as the reference sheet lays them out. */
export function sheetLayout(draft: ArticleDraft): Sheet {
  let x = MARGIN;
  let maxH = 0;
  const pieces: PlacedPiece[] = [];
  for (const piece of draft.pieces) {
    const placed = place(draft, piece, x);
    maxH = Math.max(maxH, placed.hgt);
    pieces.push(placed);
    x += placed.w + GAP;
  }
  return { pieces, width: Math.ceil(x - GAP + MARGIN), height: Math.ceil(maxH + 2 * MARGIN + 60) };
}
