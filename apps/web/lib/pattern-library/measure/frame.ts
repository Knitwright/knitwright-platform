import type { PatternPiece, Point } from "@/lib/production/contract";
import { cross, dot, sub, unit } from "../geometry";

/**
 * A torso piece is half a garment, drawn against its fold. Distances "along" the fold give
 * lengths and drops; distances "across" it, doubled, give widths. Working from the fold line
 * rather than from the page axes means a piece drawn any way round measures the same.
 */
export type FoldFrame = Readonly<{
  along: (p: Point) => number;
  across: (p: Point) => number;
}>;

export function foldFrame(piece: Pick<PatternPiece, "foldLine">): FoldFrame | null {
  const fold = piece.foldLine;
  if (!fold) return null;
  const direction = unit(sub(fold.to, fold.from));
  if (direction[0] === 0 && direction[1] === 0) return null;
  return {
    along: (p) => dot(sub(p, fold.from), direction),
    across: (p) => Math.abs(cross(direction, sub(p, fold.from))),
  };
}

/** What a measurement says about the line it was read from, so nobody takes a drawn outline for a finished garment. */
export function lineNote(piece: Pick<PatternPiece, "sewLine" | "outlineKind">): string {
  if (piece.sewLine) return "on the sew line";
  if (piece.outlineKind === "with-seam-allowance") return "on the cut outline, which holds seam allowance, so the finished size is smaller";
  if (piece.outlineKind === "without-seam-allowance") return "on the outline, which is the sewn size";
  return "on the outline as drawn; the file does not say whether it holds seam allowance";
}
