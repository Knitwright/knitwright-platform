import { skuOf } from "./push";
import type { ChannelOrderRow, ListingRow } from "./store";

/** The rows of the two CSV exports (plan v6 C4, decision 0155). Pure. Money as decimal pounds for a spreadsheet. */

export const PRODUCT_HEADER = ["sku", "product_id", "product", "size", "stage", "shopify_price", "currency", "shopify_product_id"] as const;
export const ORDER_HEADER = ["received_at", "channel", "order", "line", "product", "size", "pieces", "state", "message", "knitwright_order_id", "tracking_sent_at"] as const;

type Cell = string | number | null;

const decimal = (minor: number): string => (minor / 100).toFixed(2);

export function productRows(
  products: readonly Readonly<{ productId: string; name: string; stage: string; sizes: readonly string[] }>[],
  listings: readonly ListingRow[],
): Cell[][] {
  return products.flatMap((product) =>
    product.sizes.map((size) => {
      const listed = listings.find((listing) => listing.productId === product.productId && listing.sizeLabel === size);
      return [skuOf(product.productId, size), product.productId, product.name, size, product.stage, listed ? decimal(listed.priceMinor) : null, listed?.currency ?? null, listed?.externalProductId ?? null];
    }),
  );
}

export function orderRows(orders: readonly ChannelOrderRow[], products: readonly Readonly<{ productId: string; name: string }>[]): Cell[][] {
  const names = new Map(products.map((product) => [product.productId, product.name]));
  return orders.map((order) => [order.receivedAt, order.channel, order.orderName, order.externalLineId, names.get(order.productId) ?? order.productId, order.sizeLabel, order.pieces, order.state, order.message, order.orderId, order.trackingSyncedAt]);
}
