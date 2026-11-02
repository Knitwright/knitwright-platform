import { callCost, MAX_OUTPUT_TOKENS, estimateTokens, type ModelEntry } from "@/lib/providers/catalog";
import type { Cost } from "@/lib/usage/cost";
import { ruleBlock, SYSTEM } from "./prompt";
import type { RetrievedRule } from "./types";

/**
 * What one question costs (decision 0083). The prices come from `lib/providers/catalog.ts`; none is written
 * here. The cost is reserved before the call and given back when the call fails, as every paid call in the
 * platform is, so a question that goes wrong is not charged for.
 *
 * The estimate is the most the call can use: the fixed instructions, the rules retrieved, the question at its
 * longest and the whole output limit. Asking is one short call, so the estimate is close to the real figure.
 */

/** The longest input the estimate allows for beyond the rules: the instructions and the question. */
const inputTokensFor = (rules: readonly RetrievedRule[], question: string): number =>
  estimateTokens(SYSTEM) + estimateTokens(question) + rules.reduce((total, rule) => total + estimateTokens(ruleBlock(rule)), 0);

export const askCost = (entry: ModelEntry, rules: readonly RetrievedRule[], question: string): Cost => ({
  feature: "ai",
  microdollars: Math.max(1, callCost(entry, inputTokensFor(rules, question), MAX_OUTPUT_TOKENS)),
});
