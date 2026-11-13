import { describeTier, formatMoney, priceFor, type Ladder } from "@/lib/factory/pricing";
import type { PayCurrency } from "./settings";

/**
 * What one order costs, from the price ladder rows (plan v6 C1, decision 0152). The platform invents no price:
 * every figure is a `price_tiers` row read through `priceFor`, and a quantity the ladder does not cover is
 * unpriced, with the ladder's own reason.
 *
 * A SAMPLE has no tier of its own: the ladder starts at the club minimum. Until the owner sets a sample price
 * (owner question C1-2), a sample piece is priced at the ladder's first tier, and the label says so. That is the
 * smallest price the ladder gives for a piece of this article, not a number made up here.
 */

export type LinePrice =
  | Readonly<{ status: "priced"; unitMinor: number; valueMinor: number; label: string }>
  | Readonly<{ status: "unpriced"; reason: string }>;

export const NO_PRICE = "No price is on file for this article yet.";

const sellOf = (tier: Ladder[number], currency: PayCurrency): number | null => (currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor);

/** A sample of `pieces` (one per size), priced at the first tier of the ladder. */
export function samplePrice(ladder: Ladder, pieces: number, currency: PayCurrency): LinePrice {
  const first = [...ladder].sort((a, b) => a.qtyMin - b.qtyMin)[0];
  if (first === undefined) return { status: "unpriced", reason: NO_PRICE };
  const unit = sellOf(first, currency);
  if (unit === null) return { status: "unpriced", reason: `No ${currency} price is set for ${describeTier(first)} pieces.` };
  return {
    status: "priced",
    unitMinor: unit,
    valueMinor: unit * pieces,
    label: `Sample priced at the first tier (${describeTier(first)} pieces) until a sample price is set. ${first.label}`,
  };
}

/** A run of `pieces`, with the tier read at `tierQty` (every piece in the basket; the run alone by default). */
export function runPrice(ladder: Ladder, pieces: number, currency: PayCurrency, tierQty: number = pieces): LinePrice {
  const result = priceFor(ladder, pieces, currency, tierQty);
  if (result.status !== "priced") return { status: "unpriced", reason: ladder.length === 0 ? NO_PRICE : result.reason };
  return { status: "priced", unitMinor: result.unitMinor, valueMinor: result.lineMinor, label: result.label };
}

/** The pieces of a size breakdown. */
export const piecesOf = (sizes: Readonly<Record<string, number>>): number => Object.values(sizes).reduce((sum, count) => sum + count, 0);

/** "£87.00", or the reason there is no price. */
export const describePrice = (price: LinePrice, currency: PayCurrency): string =>
  price.status === "priced" ? formatMoney(price.valueMinor, currency) : price.reason;
