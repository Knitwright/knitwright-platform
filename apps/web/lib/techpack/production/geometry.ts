import type { PatternPiece, Point } from "@/lib/production/contract";

/** The area of a closed polyline in square millimetres (shoelace). The first point is not repeated at the end. */
export function polygonArea(points: readonly Point[]): number {
  const twice = points.reduce((sum, [x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length] ?? [x1, y1];
    return sum + (x1 * y2 - x2 * y1);
  }, 0);
  return Math.abs(twice) / 2;
}

/** The area of the whole piece in square millimetres. A piece cut on the fold is drawn as one half. */
export const pieceArea = (piece: PatternPiece): number => polygonArea(piece.cutOutline) * (piece.onFold ? 2 : 1);

/** The area of everything cut from the piece, in square millimetres. */
export const cutArea = (piece: PatternPiece): number => pieceArea(piece) * piece.quantity;

export const centroid = (points: readonly Point[]): Point => {
  const count = points.length || 1;
  return [points.reduce((sum, [x]) => sum + x, 0) / count, points.reduce((sum, [, y]) => sum + y, 0) / count];
};

export const MM2_PER_CM2 = 100;
