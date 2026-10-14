import { outlineArea } from "@/lib/production/geometry/offset";
import type { PatternPiece } from "@/lib/production/contract";
import { grainAngleDeg, openedOutline } from "./geometry";

export const MAIN_FABRIC = "main";

export type CutRow = Readonly<{
  pieceId: string;
  name: string;
  sizeLabel: string;
  quantity: number;
  mirroredPair: boolean;
  onFold: boolean;
  /** Which fabric the piece is cut from: an id the caller chose, "main" unless told. */
  fabricId: string;
  grain: Readonly<{ stated: boolean; angleDeg: number | null }>;
  /** Notch marks actually drawn on the piece, counting double and triple notches by their marks. */
  notchMarks: number;
  /** The whole piece laid flat, in square centimetres. A piece cut on the fold counts both halves. */
  areaCm2: number;
  totalAreaCm2: number;
  /** What the file says about seam allowance in the outline, in words. */
  outlineNote: string;
}>;

const MM2_PER_CM2 = 100;

const OUTLINE_NOTES = {
  "with-seam-allowance": "The outline includes the seam allowance.",
  "without-seam-allowance": "The outline is the sewing line: add the seam allowance when cutting.",
  unknown: "The pattern file does not say whether the outline includes the seam allowance.",
} as const;

export type CutListOptions = Readonly<{
  /** Piece id to fabric id. A piece not listed is cut from the main fabric. */
  assign?: Readonly<Record<string, string>>;
}>;

/** The cut list for one size of a pattern, read from the pieces themselves. */
export function cutList(pieces: readonly PatternPiece[], options: CutListOptions = {}): readonly CutRow[] {
  const assign = options.assign ?? {};
  return pieces.map((piece) => {
    const areaCm2 = outlineArea(openedOutline(piece.cutOutline, piece.onFold ? piece.foldLine : null)) / MM2_PER_CM2;
    return {
      pieceId: piece.id,
      name: piece.name,
      sizeLabel: piece.sizeLabel,
      quantity: piece.quantity,
      mirroredPair: piece.mirroredPair,
      onFold: piece.onFold,
      fabricId: Object.hasOwn(assign, piece.id) ? (assign[piece.id] as string) : MAIN_FABRIC,
      grain: piece.grainLine ? { stated: true, angleDeg: grainAngleDeg(piece.grainLine) } : { stated: false, angleDeg: null },
      notchMarks: piece.notches.reduce((sum, n) => sum + n.count, 0),
      areaCm2,
      totalAreaCm2: areaCm2 * piece.quantity,
      outlineNote: OUTLINE_NOTES[piece.outlineKind],
    };
  });
}

/** Cut area of one fabric in square centimetres, quantities included. */
export function totalAreaCm2(rows: readonly CutRow[], fabricId: string): number {
  return rows.filter((r) => r.fabricId === fabricId).reduce((sum, r) => sum + r.totalAreaCm2, 0);
}
