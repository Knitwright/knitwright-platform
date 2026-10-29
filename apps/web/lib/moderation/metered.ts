import type { ModelEntry } from "@/lib/providers/catalog";
import type { UsageMeter } from "@/lib/usage/meter";
import { microdollars } from "@/lib/usage/cost";
import type { VisionCheck } from "./vision";
import { VISION_MAX_OUTPUT_TOKENS } from "./vision";

/**
 * A vision check that pays through the usage meter like every other AI call (plan rule: metering on paid calls). The cost is
 * reserved before the call, against the person and brand who uploaded, and given back when the call fails. A refusal by the
 * meter (allowance used up) means the check does not run, which the screen treats as "a person will look".
 */

/** The input of one screening: about 1,000 tokens for a 768 px picture plus the instructions. An estimate, labelled as such. */
export const VISION_INPUT_TOKENS_ESTIMATE = 1_300;

export function visionCostMicrodollars(entry: Pick<ModelEntry, "inputPerMillion" | "outputPerMillion">): number {
  const dollars = (VISION_INPUT_TOKENS_ESTIMATE * entry.inputPerMillion + VISION_MAX_OUTPUT_TOKENS * entry.outputPerMillion) / 1_000_000;
  return Math.max(1, microdollars(dollars));
}

type Who = Readonly<{ brandId: string; userId: string }>;

export function meteredVision(vision: VisionCheck, meter: UsageMeter, who: Who, cost: number, route: string): VisionCheck {
  return {
    name: vision.name,
    async inspect(image, signal) {
      const reservation = await meter.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "ai", microdollars: cost }, route });
      if (!reservation.ok) throw new Error(`The AI allowance (${reservation.refused}) is used up.`);
      try {
        return await vision.inspect(image, signal);
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}
