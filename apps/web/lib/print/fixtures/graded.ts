import { gradedPatternSchema, type GradedPattern, type PatternPiece } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";

/**
 * A TEST graded set: the benchmark jersey at EU 48 scaled about the origin by a stated factor per size. It exists so
 * code can be tested across several sizes. It is not a grading rule and its numbers are never shown to a person as
 * measurements. The real graded set comes from the pattern library (W1).
 */
export const TEST_SIZE_FACTORS: Readonly<Record<string, number>> = { "44": 0.92, "46": 0.96, "48": 1, "50": 1.04, "52": 1.08, "54": 1.12, "56": 1.16 };

const scaled = (piece: PatternPiece, size: string, factor: number): PatternPiece => {
  const p = ([x, y]: readonly [number, number]): [number, number] => [x * factor, y * factor];
  return {
    ...piece,
    sizeLabel: size,
    cutOutline: piece.cutOutline.map(p),
    sewLine: piece.sewLine === null ? null : piece.sewLine.map(p),
    notches: piece.notches.map((n) => ({ ...n, at: p(n.at) })),
    grainLine: piece.grainLine === null ? null : { from: p(piece.grainLine.from), to: p(piece.grainLine.to) },
    foldLine: piece.foldLine === null ? null : { from: p(piece.foldLine.from), to: p(piece.foldLine.to) },
    internalLines: piece.internalLines.map((line) => line.map(p)),
    landmarks: Object.fromEntries(Object.entries(piece.landmarks).map(([id, at]) => [id, p(at)])),
  };
};

export function testGraded(base: GradedPattern = JERSEY_EU48, factors: Readonly<Record<string, number>> = TEST_SIZE_FACTORS): GradedPattern {
  const baseSize = base.sizes[0];
  const sizes = Object.keys(factors);
  return gradedPatternSchema.parse({
    ...base,
    sizes,
    piecesBySize: Object.fromEntries(sizes.map((size) => [size, base.piecesBySize[baseSize].map((piece) => scaled(piece, size, factors[size]))])),
  });
}

export const TEST_GRADED_JERSEY: GradedPattern = testGraded();
export const TEST_BASE_SIZE = "48";

/** The test pattern with some landmarks taken off one piece, to see what code does when a pattern is short of them. */
export function withoutLandmarks(pieceId: string, ids: readonly string[], base: GradedPattern = TEST_GRADED_JERSEY): GradedPattern {
  return gradedPatternSchema.parse({
    ...base,
    piecesBySize: Object.fromEntries(
      Object.entries(base.piecesBySize).map(([size, pieces]) => [
        size,
        pieces.map((p) => (p.id === pieceId ? { ...p, landmarks: Object.fromEntries(Object.entries(p.landmarks).filter(([id]) => !ids.includes(id))) } : p)),
      ]),
    ),
  });
}
