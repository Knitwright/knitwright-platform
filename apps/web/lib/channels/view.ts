import { priceFor, type Ladder } from "@/lib/factory/pricing";
import { NO_SIZES } from "./push";
import type { ChannelOrderRow, ConnectionView, ListingRow } from "./store";

/**
 * What the Channels screen shows (plan v6 C4, decision 0155), worked out from rows already read. Pure, so every
 * state can be tested and drawn at /dev/channels without a database.
 */

export type ShopifyState =
  | Readonly<{ state: "not_set_up" }>
  | Readonly<{ state: "available"; testMode: boolean }>
  | Readonly<{ state: "connected"; testMode: boolean; connection: ConnectionView }>;

export type ChannelProduct = Readonly<{
  productId: string;
  name: string;
  sizes: readonly string[];
  /** The production price of one piece, where the ladder has one. */
  unitCostMinor: number | null;
  costNote: string;
  listing: Readonly<{ priceMinor: number; currency: "GBP" | "AUD"; pushedAt: string; sizes: number }> | null;
  /** Why it cannot be listed, or null when it can. */
  blocked: string | null;
}>;

export type ChannelOrderView = ChannelOrderRow & Readonly<{ productName: string }>;

export type ChannelsPage = Readonly<{
  /** Owners and admins connect and disconnect. */
  canConnect: boolean;
  /** Owners, admins and kit managers list products and import orders. */
  canList: boolean;
  shopify: ShopifyState;
  products: readonly ChannelProduct[];
  orders: readonly ChannelOrderView[];
}>;

export const NOT_READY = "Not ready to sell: approve its golden sample first, so it can be made in runs.";

export type ProductInput = Readonly<{ productId: string; name: string; stage: string; sizes: readonly string[]; ladder: Ladder }>;

export function costOf(ladder: Ladder, currency: "GBP" | "AUD"): Readonly<{ unitCostMinor: number | null; costNote: string }> {
  const price = priceFor(ladder, 1, currency);
  return price.status === "priced" ? { unitCostMinor: price.unitMinor, costNote: price.label } : { unitCostMinor: null, costNote: `${price.reason} Knitwright invoices the making.` };
}

export function channelProducts(products: readonly ProductInput[], listings: readonly ListingRow[], currency: "GBP" | "AUD"): readonly ChannelProduct[] {
  return products.map((product) => {
    const mine = listings.filter((listing) => listing.productId === product.productId);
    const newest = mine[0];
    return {
      productId: product.productId,
      name: product.name,
      sizes: product.sizes,
      ...costOf(product.ladder, currency),
      listing: newest ? { priceMinor: newest.priceMinor, currency: newest.currency, pushedAt: newest.pushedAt, sizes: mine.length } : null,
      blocked: product.stage !== "run" ? NOT_READY : product.sizes.length === 0 ? NO_SIZES : null,
    };
  });
}

/** Profit and margin per piece at a retail price, or null without a production price. */
export function marginOf(priceMinor: number, unitCostMinor: number | null): Readonly<{ profitMinor: number; marginPercent: number }> | null {
  if (unitCostMinor === null || priceMinor <= 0) return null;
  const profitMinor = priceMinor - unitCostMinor;
  return { profitMinor, marginPercent: Math.round((profitMinor / priceMinor) * 1000) / 10 };
}

export const ORDER_STATE_LABEL: Readonly<Record<ChannelOrderRow["state"], string>> = {
  received: "Received",
  submitted: "Sent to production",
  refused: "Refused",
};

export const withNames = (orders: readonly ChannelOrderRow[], products: readonly Readonly<{ productId: string; name: string }>[]): readonly ChannelOrderView[] => {
  const names = new Map(products.map((product) => [product.productId, product.name]));
  return orders.map((order) => ({ ...order, productName: names.get(order.productId) ?? "A removed product" }));
};
