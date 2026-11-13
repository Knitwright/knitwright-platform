import { describeTier, type Ladder } from "@/lib/factory/pricing";
import type { Currency } from "./listing";

/**
 * PRICING WITH PROFIT (09 screen 23 "cost / price / profit per size"; spec F-L5 "the seller sets retail. Knitwright
 * keeps the base price plus shipping and duty"; F-L7's margin calculator).
 *
 * The production cost is never a number made up here: it is the price ladder's own sell price for the article
 * (decision 0071). A made-to-order sale goes into a weekly batch whose size nobody knows in advance, so the cost
 * shown is the ladder's FIRST tier — the smallest batch, the dearest piece — and the label says so. The ladder has
 * no price per size, so every size shows the same cost. Shipping is charged to the shopper separately and card
 * fees are Stripe's; neither is invented here.
 */

export type UnitCost =
  | Readonly<{ status: "priced"; unitMinor: number; label: string }>
  | Readonly<{ status: "unpriced"; reason: string }>;

export const NO_LADDER = "No price is on file for this article yet, so the production cost is not known.";

/** The cost of one piece in a made-to-order batch, read from the ladder's first tier. */
export function unitCost(ladder: Ladder, currency: Currency): UnitCost {
  const first = [...ladder].sort((a, b) => a.qtyMin - b.qtyMin)[0];
  if (first === undefined) return { status: "unpriced", reason: NO_LADDER };
  const unit = currency === "GBP" ? first.sellGbpMinor : first.sellAudMinor;
  if (unit === null) return { status: "unpriced", reason: `No ${currency} price is set for ${describeTier(first)} pieces.` };
  return { status: "priced", unitMinor: unit, label: `Priced at the ladder's first tier (${describeTier(first)} pieces), the dearest a piece costs. ${first.label}` };
}

export interface PriceRow {
  readonly size: string;
  readonly costMinor: number | null;
  readonly retailMinor: number | null;
  readonly profitMinor: number | null;
  /** Profit over retail, in basis points (6000 = 60%). */
  readonly marginBp: number | null;
}

/** One row per size: cost, the seller's retail, profit and margin. A row with no retail or no cost has no profit. */
export function priceRows(sizes: readonly string[], prices: Readonly<Record<string, number>>, cost: UnitCost): readonly PriceRow[] {
  const costMinor = cost.status === "priced" ? cost.unitMinor : null;
  return sizes.map((size) => {
    const retail = (prices[size] ?? 0) > 0 ? (prices[size] as number) : null;
    const profit = retail !== null && costMinor !== null ? retail - costMinor : null;
    return { size, costMinor, retailMinor: retail, profitMinor: profit, marginBp: profit !== null && retail ? Math.round((profit * 10_000) / retail) : null };
  });
}

/** True when every priced size sells above its cost. False while any is at or below cost, or the cost is unknown. */
export function pricesAboveCost(rows: readonly PriceRow[]): boolean {
  const priced = rows.filter((row) => row.retailMinor !== null);
  return priced.length > 0 && priced.every((row) => row.profitMinor !== null && row.profitMinor > 0);
}

/** "60%". */
export const percent = (bp: number | null): string => (bp === null ? "—" : `${Math.round(bp / 100)}%`);

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL"];

const rank = (size: string): readonly [number, number] => {
  const letter = SIZE_ORDER.indexOf(size.toUpperCase());
  if (letter >= 0) return [0, letter];
  const number = Number.parseFloat(size);
  return Number.isFinite(number) ? [1, number] : [2, 0];
};

/**
 * Size labels in wearing order: letter sizes smallest first, then numbers (kids' ages, waists) by value, then anything
 * else as written. A stored price list keeps no order of its own, so the storefront orders it here.
 */
export function orderSizes(sizes: readonly string[]): readonly string[] {
  return [...sizes].sort((a, b) => {
    const [ga, va] = rank(a);
    const [gb, vb] = rank(b);
    return ga - gb || va - vb || a.localeCompare(b);
  });
}

/** Sizes in the order the design gives them, kept to sizes the listing could sell. */
export const sizesOf = (sizeRun: readonly string[]): readonly string[] => [...new Set(sizeRun.map((size) => size.trim()).filter((size) => size.length > 0))];
