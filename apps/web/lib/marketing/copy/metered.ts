import { MAX_TEXT_INPUT_TOKENS, estimateTokens, type ModelEntry } from "@/lib/providers/catalog";
import type { TextModelProvider } from "@/lib/providers/text-model";
import { microdollars } from "@/lib/usage/cost";
import type { UsageMeter } from "@/lib/usage/meter";
import { MARKETING_RULE } from "../rules";
import { WRITE_MAX_OUTPUT_TOKENS, writePrompt, type WriteRequest, type WriteResult } from "./write";

/**
 * METERING ON EVERY PAID CALL (plan rule; L4, decision 0094).
 *
 * "Write for me" reaches a text model, so it pays through the usage meter like every other AI call
 * on this platform: the cost is reserved before the call and given back when the call fails or
 * comes back with nothing. A refusal by the meter means nothing is written and nothing is charged,
 * and the panel says so in the meter's own words.
 *
 * It is the shape `lib/inspiration/suggest/metered.ts` uses, deliberately: one wrapper round the
 * provider, so the writer itself has no idea that money exists and cannot forget to pay.
 */

/** Said when the brand's AI allowance for the month is used up. Nothing is written and nothing is charged. */
export const ALLOWANCE_USED_UP = "The AI allowance for this month is used up, so nothing has been written.";

/** What one run would cost, in whole microdollars, erring high: the whole prompt and a full reply. */
export function writeCostMicrodollars(entry: Pick<ModelEntry, "inputPerMillion" | "outputPerMillion">, request: WriteRequest): number {
  const prompt = writePrompt(request);
  const inputTokens = Math.min(estimateTokens(prompt.system) + estimateTokens(prompt.user), MAX_TEXT_INPUT_TOKENS);
  // A price per million tokens in dollars is the same number as microdollars per token.
  const dollars = (inputTokens * entry.inputPerMillion + WRITE_MAX_OUTPUT_TOKENS * entry.outputPerMillion) / 1_000_000;
  return Math.max(1, microdollars(dollars));
}

type Who = Readonly<{ brandId: string; userId: string }>;

export interface MeteredWriter {
  write(request: WriteRequest): Promise<WriteResult>;
}

/**
 * The writer with the meter round it. `write` is the one door: reserve, call, and give the cost
 * back when the call failed or produced nothing a field can hold, so a person is never charged for
 * an empty answer.
 */
export function meteredWriter(
  writer: (request: WriteRequest) => Promise<WriteResult>,
  meter: UsageMeter,
  who: Who,
  entry: Pick<ModelEntry, "inputPerMillion" | "outputPerMillion">,
  route: string,
): MeteredWriter {
  return {
    async write(request) {
      const cost = writeCostMicrodollars(entry, request);
      const reservation = await meter.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "ai", microdollars: cost }, route });
      if (!reservation.ok) return { ok: false, reason: ALLOWANCE_USED_UP, ruleId: MARKETING_RULE };
      try {
        const result = await writer(request);
        if (!result.ok) await meter.refund(reservation.eventId).catch(() => false);
        return result;
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}

/** The writer a route builds: the provider, the meter and who is asking, in one object. */
export const writerFor = (
  provider: TextModelProvider,
  run: (provider: TextModelProvider, request: WriteRequest) => Promise<WriteResult>,
): ((request: WriteRequest) => Promise<WriteResult>) => (request) => run(provider, request);
