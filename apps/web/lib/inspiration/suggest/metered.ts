import type { ModelEntry } from "@/lib/providers/catalog";
import { microdollars } from "@/lib/usage/cost";
import type { UsageMeter } from "@/lib/usage/meter";
import { VISION_MAX_OUTPUT_TOKENS, type ElementReader } from "./elements";

/**
 * "Suggest from this" reaches a vision model, so it pays through the usage meter like every other AI call (plan rule:
 * metering on paid calls). The cost is reserved before the call and given back when the call fails. A refusal by the
 * meter means no suggestion is made, which the panel says plainly.
 */

/** About 1,100 tokens for one 768 px picture plus the instructions. An estimate, labelled as such. */
export const SUGGEST_INPUT_TOKENS_ESTIMATE = 1_400;

export function suggestCostMicrodollars(entry: Pick<ModelEntry, "inputPerMillion" | "outputPerMillion">): number {
  const dollars = (SUGGEST_INPUT_TOKENS_ESTIMATE * entry.inputPerMillion + VISION_MAX_OUTPUT_TOKENS * entry.outputPerMillion) / 1_000_000;
  return Math.max(1, microdollars(dollars));
}

/** Said when the brand's AI allowance is used up. Nothing is suggested and nothing is charged. */
export const ALLOWANCE_USED_UP = "The AI allowance for this month is used up, so no suggestion was made.";

type Who = Readonly<{ brandId: string; userId: string }>;

export function meteredReader(reader: ElementReader, meter: UsageMeter, who: Who, cost: number, route: string): ElementReader {
  return {
    name: reader.name,
    async read(card, signal) {
      const reservation = await meter.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "ai", microdollars: cost }, route });
      if (!reservation.ok) throw new Error(ALLOWANCE_USED_UP);
      try {
        return await reader.read(card, signal);
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}
