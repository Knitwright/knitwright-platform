import type { PatternPiece, Point } from "@/lib/production/contract";

/**
 * Lays one size's pieces out on a sheet in millimetres, y down, for the 1:1 PDF and the SVG.
 * Pattern points are CAD points (y up); turning them to sheet points flips the axis, which is a
 * change of coordinates, not a mirror: the piece reads the same way round as in the DXF.
 */

export const SHEET_MARGIN_MM = 20;
/** Room at the top of the sheet for the title and the 100 mm scale bar. */
export const SHEET_HEADER_MM = 30;
const GAP_MM = 20;
/** About the width of a plotter roll; pieces wrap onto a new row after it. */
const MAX_ROW_MM = 1600;

export interface PlacedLine {
  readonly from: Point;
  readonly to: Point;
}

export interface PlacedPiece {
  readonly name: string;
  readonly size: string;
  readonly quantity: number;
  readonly mirroredPair: boolean;
  readonly onFold: boolean;
  readonly cut: readonly Point[];
  readonly sew: readonly Point[] | null;
  readonly grain: PlacedLine | null;
  readonly fold: PlacedLine | null;
  readonly internal: readonly (readonly Point[])[];
  /** Each notch with the point it faces (the piece's centre), so a mark can be drawn inward. */
  readonly notches: readonly { readonly at: Point; readonly toward: Point; readonly count: number }[];
  readonly centre: Point;
}

export interface Sheet {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly pieces: readonly PlacedPiece[];
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const r2 = (n: number): number => {
  const v = Math.round(n * 100) / 100;
  return v === 0 ? 0 : v;
};

function boxOf(piece: PatternPiece): Box {
  const xs = piece.cutOutline.map((p) => p[0]);
  const ys = piece.cutOutline.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function place(piece: PatternPiece, box: Box, ox: number, oy: number): PlacedPiece {
  const at = (p: Point): Point => [r2(p[0] - box.minX + ox), r2(box.maxY - p[1] + oy)];
  const line = (l: { from: Point; to: Point } | null): PlacedLine | null => (l ? { from: at(l.from), to: at(l.to) } : null);
  const centre: Point = [r2((box.maxX - box.minX) / 2 + ox), r2((box.maxY - box.minY) / 2 + oy)];
  return {
    name: piece.name,
    size: piece.sizeLabel,
    quantity: piece.quantity,
    mirroredPair: piece.mirroredPair,
    onFold: piece.onFold,
    cut: piece.cutOutline.map(at),
    sew: piece.sewLine ? piece.sewLine.map(at) : null,
    grain: line(piece.grainLine),
    fold: line(piece.foldLine),
    internal: piece.internalLines.map((run) => run.map(at)),
    notches: piece.notches.map((n) => ({ at: at(n.at), toward: centre, count: n.count })),
    centre,
  };
}

/** Rows of pieces, left to right, wrapping after the row width. Deterministic: the pieces' own order. */
export function layoutSheet(pieces: readonly PatternPiece[]): Sheet {
  const placed: PlacedPiece[] = [];
  let x = SHEET_MARGIN_MM;
  let y = SHEET_MARGIN_MM + SHEET_HEADER_MM;
  let rowHeight = 0;
  let widest = 0;
  for (const piece of pieces) {
    const box = boxOf(piece);
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    if (x > SHEET_MARGIN_MM && x + w > SHEET_MARGIN_MM + MAX_ROW_MM) {
      x = SHEET_MARGIN_MM;
      y += rowHeight + GAP_MM;
      rowHeight = 0;
    }
    placed.push(place(piece, box, x, y));
    widest = Math.max(widest, x + w);
    x += w + GAP_MM;
    rowHeight = Math.max(rowHeight, h);
  }
  return { widthMm: r2(Math.max(widest, 120) + SHEET_MARGIN_MM), heightMm: r2(y + rowHeight + SHEET_MARGIN_MM), pieces: placed };
}

/** The short mark drawn for a notch: 5 mm from the edge toward the piece's centre. */
export function notchMark(at: Point, toward: Point, lengthMm = 5): Point {
  const dx = toward[0] - at[0];
  const dy = toward[1] - at[1];
  const d = Math.hypot(dx, dy) || 1;
  return [r2(at[0] + (dx / d) * lengthMm), r2(at[1] + (dy / d) * lengthMm)];
}

/** The lines of a piece's label, in reading order. */
export function pieceLabel(p: PlacedPiece): string[] {
  const cut = p.mirroredPair ? `Cut ${p.quantity} (${p.quantity / 2} pair${p.quantity === 2 ? "" : "s"}, mirrored)` : `Cut ${p.quantity}`;
  return [p.name, `Size ${p.size}`, p.onFold ? `${cut}, on fold` : cut];
}
