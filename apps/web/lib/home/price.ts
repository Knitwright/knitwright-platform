import { describeTier, formatMoney, tierFor, type Ladder } from "@/lib/factory/pricing";
import { GAP_RULE_ID, type PriceTier, type SellCurrency } from "@/lib/factory/schemas";

/**
 * The "From £x · from 1 pc" line of a catalogue card and the price ladder of an article page
 * (spec F-S4 grid cards, F-S8 price ladder), read from X6's price tiers (decision 0071).
 *
 * Every seeded price is a placeholder. Nothing here makes one up: where no tier carries a price in
 * the chosen currency the line says the price is not set, and where a tier does, the tier's own
 * stored label travels with it so no screen can show it as a factory quote. The smallest order the
 * factory takes comes from the capability's minimum, never from the tier the price happens to be in.
 */

export interface PriceSource {
  readonly ladder: Ladder;
  /** The capability's minimum order quantity, or null when it is not set. */
  readonly moq: number | null;
}

export interface FromPrice {
  /** "From £22.00", or "Price not set yet". */
  readonly amount: string;
  /** "from 1 pc", "50+ pcs", or null when no quantity is known. */
  readonly quantity: string | null;
  /** The whole line: "From £22.00 · from 1 pc". */
  readonly line: string;
  readonly priced: boolean;
  /** The stored label of the tier the price came from; null when there is no price. */
  readonly label: string | null;
  readonly ruleId: string;
  /** Says so where the factory's smallest order has no tier covering it. */
  readonly note: string | null;
}

const sellOf = (tier: PriceTier, currency: SellCurrency): number | null =>
  currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor;

/** The tier with the lowest unit price in this currency, or null when no tier carries one. */
export function cheapestTier(ladder: Ladder, currency: SellCurrency): PriceTier | null {
  const priced = ladder.filter((tier) => sellOf(tier, currency) !== null);
  if (priced.length === 0) return null;
  return priced.reduce((best, tier) => (sellOf(tier, currency)! < sellOf(best, currency)! ? tier : best));
}

const pieces = (count: number): string => `${count} pc${count === 1 ? "" : "s"}`;

/** "from 1 pc" from the factory's minimum, or the tier's own range where no minimum is stored. */
const quantityText = (source: PriceSource, tier: PriceTier | null): string | null => {
  if (source.moq !== null) return `from ${pieces(source.moq)}`;
  return tier ? `${describeTier(tier)} pcs` : null;
};

/** "Priced from 10 pieces" where the smallest order the factory takes falls below every tier. */
const noteFor = (source: PriceSource): string | null => {
  if (source.moq === null || source.ladder.length === 0) return null;
  if (tierFor(source.ladder, source.moq) !== null) return null;
  const smallest = Math.min(...source.ladder.map((tier) => tier.qtyMin));
  return `Priced from ${pieces(smallest)}; no price is set for ${pieces(source.moq)} yet.`;
};

export function fromPrice(source: PriceSource, currency: SellCurrency): FromPrice {
  const tier = cheapestTier(source.ladder, currency);
  const quantity = quantityText(source, tier);
  const amount = tier ? `From ${formatMoney(sellOf(tier, currency)!, currency)}` : `No ${currency} price is set yet`;
  return {
    amount,
    quantity,
    line: quantity ? `${amount} · ${quantity}` : amount,
    priced: tier !== null,
    label: tier?.label ?? null,
    ruleId: tier?.ruleId ?? GAP_RULE_ID,
    note: tier ? noteFor(source) : null,
  };
}

export interface LadderRow {
  /** "10-19" or "50+". */
  readonly quantity: string;
  /** "£29.00", or the reason there is no price. */
  readonly unit: string;
  readonly priced: boolean;
  readonly label: string;
  readonly ruleId: string;
}

/** The price ladder of an article page, smallest quantity first. Empty where the article has no tiers. */
export function ladderRows(ladder: Ladder, currency: SellCurrency): readonly LadderRow[] {
  return [...ladder]
    .sort((a, b) => a.qtyMin - b.qtyMin)
    .map((tier) => {
      const sell = sellOf(tier, currency);
      return {
        quantity: describeTier(tier),
        unit: sell === null ? `No ${currency} price is set yet` : formatMoney(sell, currency),
        priced: sell !== null,
        label: tier.label,
        ruleId: tier.ruleId,
      };
    });
}
