import { describeTier, type Ladder } from "@/lib/factory/pricing";
import { SELL_CURRENCIES, type SellCurrency } from "@/lib/factory/schemas";
import { because, gap, held, type Known } from "./gap";

/**
 * Tier prices in the contract (plan v5 O2; X6's ladders, decision 0071).
 *
 * The ladder is read from `price_tiers`, never from a literal: a tier's quantity band, its sell
 * figure in each currency, its provenance label and its rule id are all columns. Nothing here
 * rounds and nothing here multiplies: the Store is told the figure for one piece in each band, in
 * integer minor units, and works out its own lines.
 *
 * Two currencies, and today only one of them has any figure at all. O3 seeded the Australian tiers
 * with `sell_aud_minor` null on every row, because no Australian dollar figure is published
 * anywhere (decision 0104). So the Australian side of every band is a gap. It is **never** the
 * pound figure converted: a rate nobody published is as invented as a price nobody published, and
 * `money.test.ts` holds the pound figure to appearing nowhere inside an Australian entry.
 */

/** What one piece costs in one currency inside one band, or why no figure exists. */
export type TierPrice = Known<{ unitMinor: number }>;

/** One band of the ladder, with a figure per currency. */
export interface StoreTier {
  readonly qtyMin: number;
  /** Null is the open top band: "50 and up". It is not a missing value, so it is not a gap. */
  readonly qtyMax: number | null;
  /** How the band reads: "10-19", "50+". */
  readonly band: string;
  /** The provenance label of the row the figures came from, word for word. */
  readonly label: string;
  readonly ruleId: string;
  readonly prices: Readonly<Record<SellCurrency, TierPrice>>;
}

export type StorePrices = Known<{
  /** The currencies the contract carries, whether or not each has a figure. */
  currencies: readonly SellCurrency[];
  tiers: readonly StoreTier[];
}>;

/**
 * Why a currency has no figure. Deliberately without a digit of any kind: a Store that searched the
 * sentence for a number must find none, and a reader shown the sentence cannot mistake it for one.
 */
const NO_FIGURE: Readonly<Record<SellCurrency, string>> = {
  GBP: "a pound price for this band",
  AUD: "an Australian dollar price for this band",
};

const CONSEQUENCE: Readonly<Record<SellCurrency, string>> = {
  GBP: "the Store has no pound figure to show for it.",
  AUD: "the Store has none to show. The pound figure is not to be converted into one.",
};

const sellOf = (tier: Ladder[number], currency: SellCurrency): number | null =>
  currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor;

const priceOf = (tier: Ladder[number], currency: SellCurrency): TierPrice => {
  const minor = sellOf(tier, currency);
  return minor === null
    ? gap([NO_FIGURE[currency]], because([NO_FIGURE[currency]], CONSEQUENCE[currency]), tier.ruleId)
    : held({ unitMinor: minor });
};

const tierOf = (tier: Ladder[number]): StoreTier => ({
  qtyMin: tier.qtyMin,
  qtyMax: tier.qtyMax,
  band: describeTier(tier),
  label: tier.label,
  ruleId: tier.ruleId,
  prices: Object.fromEntries(SELL_CURRENCIES.map((currency) => [currency, priceOf(tier, currency)])) as Readonly<
    Record<SellCurrency, TierPrice>
  >,
});

const NO_LADDER = "a price ladder for this article";

/**
 * The ladder as the contract carries it, smallest band first. An article no factory has priced is
 * one gap rather than a ladder of gaps: there is no band to hang a figure on.
 */
export function storePrices(ladder: Ladder): StorePrices {
  if (ladder.length === 0) {
    return gap([NO_LADDER], because([NO_LADDER], "no factory on file has priced it and the Store has no figure of any kind for it."));
  }
  return held({
    currencies: [...SELL_CURRENCIES],
    tiers: [...ladder].sort((a, b) => a.qtyMin - b.qtyMin).map(tierOf),
  });
}

/** True when every band carries a figure in that currency: the one question "can this be sold here?" rests on. */
export function pricedIn(prices: StorePrices, currency: SellCurrency): boolean {
  return prices.status === "held" && prices.tiers.length > 0 && prices.tiers.every((tier) => tier.prices[currency].status === "held");
}
