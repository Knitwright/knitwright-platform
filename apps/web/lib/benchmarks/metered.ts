import { callCost, type ModelEntry } from "@/lib/providers/catalog";
import type { UsageMeter } from "@/lib/usage/meter";
import { EXTRACT_MAX_OUTPUT_TOKENS, type BenchmarkExtractor } from "./extract";

/**
 * An extractor that pays through the usage meter like every other AI call (plan rule: metering on paid calls). The
 * cost is reserved before the call, against the person and brand who asked, and given back when the call fails. The
 * same shape as lib/moderation/metered.ts, so there is one way of doing this in the codebase.
 */

/** A page's words plus the instructions, or a 768 px picture plus the instructions. An estimate, labelled as such. */
export const EXTRACT_INPUT_TOKENS_ESTIMATE = 5_000;

export const extractCostMicrodollars = (entry: ModelEntry): number => callCost(entry, EXTRACT_INPUT_TOKENS_ESTIMATE, EXTRACT_MAX_OUTPUT_TOKENS);

type Who = Readonly<{ brandId: string; userId: string }>;

export const ALLOWANCE_USED_UP = "The AI allowance is used up, so the card cannot be read yet.";

export function meteredExtractor(extractor: BenchmarkExtractor, meter: UsageMeter, who: Who, cost: number, route: string): BenchmarkExtractor {
  return {
    name: extractor.name,
    async extract(input, signal) {
      const reservation = await meter.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "ai", microdollars: cost }, route });
      if (!reservation.ok) throw new Error(ALLOWANCE_USED_UP);
      try {
        return await extractor.extract(input, signal);
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}
