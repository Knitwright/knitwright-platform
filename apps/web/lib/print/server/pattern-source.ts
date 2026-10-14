import type { GradedPattern } from "@/lib/production/contract";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";

export interface PatternSource {
  readonly pattern: GradedPattern;
  /** The size the pattern is drawn at. */
  readonly baseSize: string;
  /** True once a technician has reviewed the pattern (open item P1). No source is reviewed yet. */
  readonly reviewed: boolean;
  /** Where the pattern came from, in plain words, for the manifest. */
  readonly description: string;
}

export const NO_PATTERN_SENTENCE = "There is no pattern for this garment yet, so no print files can be made.";

/**
 * The pattern a garment type is printed on. Until the pattern library (W1) is in, the two benchmark patterns stand in: one
 * size each, converted from the fashionINSTA files. The library replaces this one function; nothing else reads fixtures.
 */
export function patternFor(typeId: string): PatternSource | null {
  if (typeId === "team-jersey") return { pattern: JERSEY_EU48, baseSize: "48", reviewed: false, description: "Benchmark jersey pattern, EU 48 (from the fashionINSTA file)" };
  if (typeId === "crew-tee") return { pattern: TEE_EU48, baseSize: "48", reviewed: false, description: "Benchmark crew tee pattern, EU 48 (from the fashionINSTA file)" };
  return null;
}
