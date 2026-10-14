import type { PatternPiece, Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { round2 } from "../geometry";

/**
 * A size run for tests only: the benchmark jersey's pieces scaled evenly about the page origin,
 * one factor per size. It is NOT a real grade (a real grade moves each point by its own rule)
 * and no number from it may be shown as a measurement. It exists so the library's handling of
 * seven sizes, of one file per size and of a broken seam can be tested.
 */
export const MEN_RUN = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

const FACTORS: Readonly<Record<string, number>> = { XS: 0.92, S: 0.96, M: 1, L: 1.04, XL: 1.08, "2XL": 1.12, "3XL": 1.16 };

const scaled = (p: Point, k: number): Point => [round2(p[0] * k), round2(p[1] * k)];

export function scalePiece(piece: PatternPiece, size: string, k: number): PatternPiece {
  const line = (l: { from: Point; to: Point } | null) => (l ? { from: scaled(l.from, k), to: scaled(l.to, k) } : null);
  return {
    ...piece,
    sizeLabel: size,
    cutOutline: piece.cutOutline.map((p) => scaled(p, k)),
    sewLine: piece.sewLine ? piece.sewLine.map((p) => scaled(p, k)) : null,
    notches: piece.notches.map((n) => ({ ...n, at: scaled(n.at, k) })),
    grainLine: line(piece.grainLine),
    foldLine: line(piece.foldLine),
    internalLines: piece.internalLines.map((run) => run.map((p) => scaled(p, k))),
    landmarks: Object.fromEntries(Object.entries(piece.landmarks).map(([name, p]) => [name, scaled(p as Point, k)])),
  };
}

export const syntheticPieces = (size: (typeof MEN_RUN)[number]): PatternPiece[] =>
  JERSEY_EU48.piecesBySize["48"].map((piece) => scalePiece(piece, size, FACTORS[size]));
