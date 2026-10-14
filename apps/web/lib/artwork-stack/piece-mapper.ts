import type { ViewId } from "./anchors";
import type { PointMm } from "./units";

/** A point on one pattern piece, in millimetres in the piece's own plane (W0 `PatternPiece` coordinates). */
export interface PieceHit {
  readonly pieceId: string;
  readonly xMm: number;
  readonly yMm: number;
}

/**
 * Maps design space to a pattern piece for one size, by landmark fit (decision 0034: the piece is the master).
 * Interface only: the print files (W3) build it. A point that falls on no piece of that view gives null.
 */
export interface PieceMapper {
  toPiece(view: ViewId, point: PointMm, size: string): PieceHit | null;
}
