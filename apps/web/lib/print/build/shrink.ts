import { printScale, type FabricProfile, type PatternPiece } from "@/lib/production/contract";

interface PieceScale {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly note: string | null;
}

const BOTH: Pick<FabricProfile, "shrinkLengthPct" | "shrinkWidthPct"> = {
  shrinkLengthPct: { value: null, source: "not-set" },
  shrinkWidthPct: { value: null, source: "not-set" },
};

/**
 * The shrink scale along a piece's own x and y axes. The length of the fabric runs along the grain line, so the
 * length scale goes to the axis the grain lies nearest to. A piece with no grain line is read as grain along x.
 */
export function scaleForPiece(piece: PatternPiece, shrink: Pick<FabricProfile, "shrinkLengthPct" | "shrinkWidthPct"> = BOTH): PieceScale {
  const scale = printScale(shrink);
  const grain = piece.grainLine;
  const alongY = grain !== null && Math.abs(grain.to[1] - grain.from[1]) > Math.abs(grain.to[0] - grain.from[0]);
  return { scaleX: alongY ? scale.width : scale.length, scaleY: alongY ? scale.length : scale.width, note: scale.note };
}
