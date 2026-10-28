import { gradedPatternSchema, type GradedPattern, type PatternPiece } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { transformPiece } from "../frames/instances";
import { scaling } from "../geometry/affine";

/** Test sizes made by stretching the benchmark's EU 48 pieces: the length (x) and the width (y) of every piece. */
const TEST_SIZES: Readonly<Record<string, { readonly length: number; readonly width: number }>> = {
  "44": { length: 0.94, width: 0.92 },
  "46": { length: 0.97, width: 0.96 },
  "48": { length: 1, width: 1 },
  "50": { length: 1.03, width: 1.04 },
  "52": { length: 1.06, width: 1.08 },
};

const regrade = (piece: PatternPiece, size: string): PatternPiece => {
  const factor = TEST_SIZES[size] ?? { length: 1, width: 1 };
  return { ...transformPiece(piece, scaling(factor.length, factor.width)), sizeLabel: size };
};

/** The benchmark jersey in five sizes. A shape for tests of per-size code, not a grading rule. */
export function gradedJersey(sizes: readonly string[] = Object.keys(TEST_SIZES)): GradedPattern {
  const base = JERSEY_EU48.piecesBySize["48"] ?? [];
  return gradedPatternSchema.parse({
    blockId: JERSEY_EU48.blockId,
    blockVersion: JERSEY_EU48.blockVersion,
    sizes,
    piecesBySize: Object.fromEntries(sizes.map((size) => [size, base.map((piece) => regrade(piece, size))])),
  });
}
