import { formatMoney, priceFor, type Ladder, type PriceResult } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import { pieces, QUOTE_QUANTITIES } from "./vocabulary";

/**
 * The prices the make pages show (F-S7: "price at 1/50/100"). Every figure is a `price_tiers` row read through
 * `priceFor` (decision 0071), in integer minor units, and carries that row's own label — the seed's is "Placeholder
 * club price from the build pack, not a factory quote".
 *
 * Nothing here invents a price. A quantity the ladder does not cover is shown as not covered, with the reason the
 * ladder gives, and an article with no ladder says that no price is on file. A missing price is never a zero.
 */

export interface PriceStep {
  readonly qty: number;
  readonly result: PriceResult;
  /** The unit price in words, or why there is none. */
  readonly text: string;
  /** The label of the tier the price came from. Null when there is no price. */
  readonly label: string | null;
}

export const NO_LADDER = "No price is on file for this article yet.";

/** One quantity's step. `priceFor` reads the tier at the same quantity: one product, not a basket. */
export function priceStep(ladder: Ladder, qty: number, currency: SellCurrency): PriceStep {
  const result = priceFor(ladder, qty, currency);
  if (result.status !== "priced") {
    return { qty, result, text: ladder.length === 0 ? NO_LADDER : result.reason, label: null };
  }
  return {
    qty,
    result,
    text: `${formatMoney(result.unitMinor, result.currency)} per piece at ${pieces(qty)}`,
    label: result.label,
  };
}

/** The 1, 50 and 100 steps of the product-created summary, in the order given. */
export const priceSteps = (ladder: Ladder, currency: SellCurrency, quantities: readonly number[] = QUOTE_QUANTITIES): readonly PriceStep[] =>
  quantities.map((qty) => priceStep(ladder, qty, currency));

/** The labels the steps carry, each once, so a screen can print them under the ladder without repeating one. */
export const stepLabels = (steps: readonly PriceStep[]): readonly string[] => [...new Set(steps.map((step) => step.label).filter((label): label is string => label !== null))];

/** The line price of a quantity, in minor units, or null where the ladder gives no price. */
export const lineMinorOf = (result: PriceResult): number | null => (result.status === "priced" ? result.lineMinor : null);
