import { landedCost, type LandedCost } from "@/lib/collections/landed";
import type { LandedRates } from "@/lib/collections/types";
import type { Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";

/**
 * THE MARGIN CALCULATOR (spec F-L7: "profit per unit at a given retail price (base + freight + duty + fees)"; plan v6
 * C5, decision 0156). Pure, so the Overview's calculator, the listing editor (C3) and a selling checkout recording a
 * sale all work a margin out the same way.
 *
 * - Base, freight and duty are `landedCost` (decision 0085): the price tier for the quantity, the destination's
 *   freight row and its duty on the article's HS code. A missing row is a note, never a hidden zero.
 * - The channel fee is the channel's row: a percentage of retail plus a fixed amount, rounded once.
 * - The Knitwright fee is the payout setting's percentage of retail (0 until the owner sets one: F-L5 says
 *   Knitwright keeps the base price plus shipping and duty).
 * - Margin is retail less all of them, per unit. It may be negative: the calculator says so rather than hiding it.
 *
 * Client-safe: no zod, no server imports.
 */

export interface ChannelFee {
  readonly channel: SellerChannel;
  readonly currency: SellCurrency;
  readonly percentBps: number;
  readonly fixedMinor: number;
  readonly label: string;
  readonly isPlaceholder: boolean;
}

export const SELLER_CHANNELS = ["storefront", "team_store", "shopify", "api"] as const;
export type SellerChannel = (typeof SELLER_CHANNELS)[number];

export const CHANNEL_LABELS: Readonly<Record<SellerChannel, string>> = {
  storefront: "Knitwright storefront",
  team_store: "Knitwright team store",
  shopify: "Shopify",
  api: "API or CSV",
};

export interface MarginInput {
  readonly ladder: Ladder;
  readonly rates: LandedRates;
  readonly currency: SellCurrency;
  /** The quantity the price tier is read at: the batch the sale is made in. */
  readonly qty: number;
  readonly retailMinor: number;
  readonly fee: ChannelFee | null;
  readonly knitwrightFeeBps: number;
}

export type Margin =
  | Readonly<{
      status: "priced";
      currency: SellCurrency;
      retailMinor: number;
      baseMinor: number;
      freightMinor: number;
      dutyMinor: number;
      channelFeeMinor: number;
      knitwrightFeeMinor: number;
      /** Retail less every cost, per unit. Negative when the retail price is below cost. */
      profitMinor: number;
      /** Profit as a share of retail, in basis points; null at a retail price of nothing. */
      marginBps: number | null;
      notes: readonly string[];
      labels: readonly string[];
    }>
  | Readonly<{ status: "no-price"; reason: string }>;

/** A fee of `bps` on an amount, rounded to the penny once. */
export const feeOn = (amountMinor: number, bps: number): number => Math.round((amountMinor * bps) / 10_000);

/** What the channel takes of one sale at this retail price. */
export const channelFeeOf = (fee: ChannelFee | null, retailMinor: number): number => (fee === null ? 0 : feeOn(retailMinor, fee.percentBps) + fee.fixedMinor);

const noteOfFee = (fee: ChannelFee | null, currency: SellCurrency): string | null =>
  fee === null ? `No channel fee is on file for ${currency}, so none is in this margin.` : fee.isPlaceholder ? `Channel fee: ${fee.label}.` : null;

export function marginFor(input: MarginInput): Margin {
  if (!Number.isInteger(input.retailMinor) || input.retailMinor < 0) return { status: "no-price", reason: "Type a retail price." };
  const landed: LandedCost = landedCost({ ladder: input.ladder, qty: input.qty, currency: input.currency, rates: input.rates });
  if (landed.status !== "landed") return { status: "no-price", reason: landed.reason };
  const channelFeeMinor = channelFeeOf(input.fee, input.retailMinor);
  const knitwrightFeeMinor = feeOn(input.retailMinor, input.knitwrightFeeBps);
  const profitMinor = input.retailMinor - landed.unitMinor - channelFeeMinor - knitwrightFeeMinor;
  const feeNote = noteOfFee(input.fee, input.currency);
  return {
    status: "priced",
    currency: input.currency,
    retailMinor: input.retailMinor,
    baseMinor: landed.tierUnitMinor,
    freightMinor: landed.freightUnitMinor,
    dutyMinor: landed.dutyUnitMinor,
    channelFeeMinor,
    knitwrightFeeMinor,
    profitMinor,
    marginBps: input.retailMinor === 0 ? null : Math.round((profitMinor * 10_000) / input.retailMinor),
    notes: [...landed.notes, ...(feeNote === null ? [] : [feeNote])],
    labels: landed.labels,
  };
}

/** The parts of a sale of `quantity` units, as `record_seller_sale` takes them. Null when the margin is unknown. */
export function saleParts(margin: Margin, quantity: number) {
  if (margin.status !== "priced") return null;
  return {
    retailMinor: margin.retailMinor * quantity,
    baseMinor: margin.baseMinor * quantity,
    shippingMinor: margin.freightMinor * quantity,
    dutyMinor: margin.dutyMinor * quantity,
    channelFeeMinor: margin.channelFeeMinor * quantity,
    knitwrightFeeMinor: margin.knitwrightFeeMinor * quantity,
  } as const;
}

/** "42%", or a dash at a retail price of nothing. */
export const describeMargin = (bps: number | null): string => (bps === null ? "—" : `${Math.round(bps / 100)}%`);

/** A price typed by a person ("24.99", "£24.99") in minor units, or null when it is not one. */
export const retailFromText = (text: string): number | null => {
  const cleaned = text.replace(/[,£$A\s]/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};
