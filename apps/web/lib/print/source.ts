import type { GradedPattern } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";

export interface PatternChoice {
  readonly pattern: GradedPattern;
  /** Said in the margin of every file made from it. */
  readonly note: string;
  /** Used to choose the zones: the kind of garment. */
  readonly garment: string;
}

/**
 * Where the pattern for a design comes from. Until the pattern library (W1) is merged there is one pattern, the
 * benchmark jersey in EU 48, and it is used for team jerseys only. The files say so in their margin.
 */
export function patternFor(typeId: string): PatternChoice | null {
  if (!/jersey/.test(typeId)) return null;
  return {
    pattern: JERSEY_EU48,
    garment: typeId,
    note: "Pattern: the benchmark jersey sample (EU 48), not drawn for this design.",
  };
}
