import type { PriceTier, SellCurrency } from "./schemas";

/**
 * Prices from the price tiers (decision 0071). Pure: the ladders come in, a price in integer minor units comes out.
 * Tiers are counted across the whole basket (spec F-T5): ten jerseys and ten shorts are both priced at the 20-piece
 * tier. Nothing here rounds: a unit price times a quantity is exact in minor units, so a quote and a checkout agree
 * to the penny.
 */

export type Ladder = readonly PriceTier[];

export type PriceResult =
  | Readonly<{
      status: "priced";
      unitMinor: number;
      lineMinor: number;
      currency: SellCurrency;
      tier: Readonly<{ qtyMin: number; qtyMax: number | null }>;
      tierQty: number;
      label: string;
    }>
  | Readonly<{ status: "not-made" | "below-tiers" | "not-set"; reason: string }>;

export interface BasketLine {
  readonly articleCode: string;
  readonly qty: number;
}

export interface BasketPrice {
  readonly currency: SellCurrency;
  /** The quantity the tier is read at: every piece in the basket. */
  readonly tierQty: number;
  readonly lines: readonly (BasketLine & Readonly<{ price: PriceResult }>)[];
  /** The sum of the lines, or null while any line has no price. */
  readonly totalMinor: number | null;
}

const sellOf = (tier: PriceTier, currency: SellCurrency): number | null => (currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor);

const sorted = (ladder: Ladder): PriceTier[] => [...ladder].sort((a, b) => a.qtyMin - b.qtyMin);

/** The tier a quantity falls in, or null when it is below the smallest tier or in a gap. */
export function tierFor(ladder: Ladder, qty: number): PriceTier | null {
  return sorted(ladder).find((t) => qty >= t.qtyMin && (t.qtyMax === null || qty <= t.qtyMax)) ?? null;
}

/**
 * The price of `qty` pieces from one ladder. `tierQty` is the quantity the tier is chosen at, which for a basket is
 * every piece in it; it defaults to `qty`.
 */
export function priceFor(ladder: Ladder, qty: number, currency: SellCurrency, tierQty: number = qty): PriceResult {
  if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(tierQty) || tierQty < qty) throw new RangeError("Quantities are whole numbers of 1 or more.");
  if (ladder.length === 0) return { status: "not-made", reason: "No price ladder for this article." };
  const tier = tierFor(ladder, tierQty);
  if (tier === null) {
    const smallest = sorted(ladder)[0]!.qtyMin;
    return { status: "below-tiers", reason: `No tier covers ${tierQty} pieces. The smallest tier starts at ${smallest}.` };
  }
  const unit = sellOf(tier, currency);
  if (unit === null) return { status: "not-set", reason: `No ${currency} price is set for ${describeTier(tier)} pieces.` };
  return {
    status: "priced",
    unitMinor: unit,
    lineMinor: unit * qty,
    currency,
    tier: { qtyMin: tier.qtyMin, qtyMax: tier.qtyMax },
    tierQty,
    label: tier.label,
  };
}

/** Prices every line of a basket, each from its own ladder, with the tier read at the basket's total. */
export function priceBasket(lines: readonly (BasketLine & Readonly<{ ladder: Ladder }>)[], currency: SellCurrency): BasketPrice {
  const tierQty = lines.reduce((sum, line) => sum + line.qty, 0);
  const priced = lines.map(({ ladder, ...line }) => ({ ...line, price: priceFor(ladder, line.qty, currency, tierQty) }));
  const complete = priced.length > 0 && priced.every((line) => line.price.status === "priced");
  const totalMinor = complete ? priced.reduce((sum, line) => sum + (line.price.status === "priced" ? line.price.lineMinor : 0), 0) : null;
  return { currency, tierQty, lines: priced, totalMinor };
}

/** "10-19" or "50+". */
export const describeTier = (tier: Pick<PriceTier, "qtyMin" | "qtyMax">): string =>
  tier.qtyMax === null ? `${tier.qtyMin}+` : `${tier.qtyMin}-${tier.qtyMax}`;

/** A ladder's problem in words, or null when its tiers neither overlap nor leave a gap, and only the last is open. */
export function ladderProblem(ladder: Ladder): string | null {
  const tiers = sorted(ladder);
  for (const [i, tier] of tiers.entries()) {
    const next = tiers[i + 1];
    if (!next) break;
    if (tier.qtyMax === null) return `Tier ${describeTier(tier)} has no upper bound but another tier follows it.`;
    if (next.qtyMin <= tier.qtyMax) return `Tiers ${describeTier(tier)} and ${describeTier(next)} overlap.`;
    if (next.qtyMin > tier.qtyMax + 1) return `No tier covers ${tier.qtyMax + 1} to ${next.qtyMin - 1} pieces.`;
  }
  return null;
}

/** "£29.00" or "A$29.00": for screens only; stored values stay in minor units. */
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minorUnits / 100);
}
