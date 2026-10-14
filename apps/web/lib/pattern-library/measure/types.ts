import type { PatternMeasurement, PatternPiece } from "@/lib/production/contract";

/** One number read from the pattern, in millimetres, and how it was read. */
export type Reading = Readonly<{ pointId: string; mm: number; method: string }>;

/** A point that cannot be read from this pattern, and why, in a sentence. */
export type Skip = Readonly<{ pointId: string; reason: string }>;

export type Outcome = Reading | Skip;

export const isSkip = (outcome: Outcome): outcome is Skip => "reason" in outcome;

export type SizeMeasures = Readonly<{
  measurements: readonly PatternMeasurement[];
  skipped: readonly Skip[];
}>;

export type SizeSet = Readonly<{
  size: string;
  front?: PatternPiece;
  back?: PatternPiece;
  sleeve?: PatternPiece;
  collar?: PatternPiece;
  seams: ReadonlyMap<string, readonly import("../seams").Seam[]>;
}>;

export const skip = (pointId: string, reason: string): Skip => ({ pointId, reason });
export const reading = (pointId: string, mm: number, method: string): Reading => ({ pointId, mm, method });
