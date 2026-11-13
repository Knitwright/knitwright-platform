import { noRates } from "@/lib/collections/landed";
import type { Ladder } from "@/lib/factory/pricing";
import { marginFor, saleParts, type ChannelFee } from "@/lib/store-pages/margin";
import type { NewSale } from "@/lib/store-pages/sales";
import type { UnitCost } from "./pricing";
import type { ShopOrder } from "./rows";

/**
 * A STOREFRONT SALE FOR THE SELLER'S PAYOUT (plan v6 C3 on C5, decisions 0154 and 0156; spec F-L5 "the seller's
 * margin is paid out weekly after delivery confirmation"). Each paid shop order is recorded through C5's
 * `record_seller_sale` — keyed on the order, so recording it again changes nothing — and its batch's production order
 * is attached once sent, so delivery can be seen. A refund is reported as the total refunded so far.
 *
 * The figures are C5's own margin calculator, fed with what the listing editor shows the seller: retail is what the
 * shopper paid a piece (personalisation included), the base is the listing's production cost (the ladder's first
 * tier, `pricing.ts`, held as one tier so the calculator reads exactly it), no freight or duty (shipping is charged to
 * the shopper apart), the `storefront` channel fee row and the payout setting's Knitwright fee. An order whose cost
 * is not on file yet records nothing until it is: the next run records it then.
 */

export const shopSaleRef = (order: Pick<ShopOrder, "id">): string => `storefront:${order.id}`;

/** One tier at the listing's production cost, so the calculator prices every quantity at it. */
const costLadder = (unitMinor: number, currency: "GBP" | "AUD", label: string): Ladder => [
  {
    id: "00000000-0000-4000-8000-000000000000",
    capabilityId: "00000000-0000-4000-8000-000000000000",
    qtyMin: 1,
    qtyMax: null,
    cost: null,
    sellGbpMinor: currency === "GBP" ? unitMinor : null,
    sellAudMinor: currency === "AUD" ? unitMinor : null,
    personalisationCostMinor: null,
    ruleId: "R-GAP-000",
    label: label.slice(0, 200) || "Production cost",
  },
];

export interface SaleListing {
  readonly productId: string | null;
  readonly title: string;
}

export function shopSale(
  order: ShopOrder,
  listing: SaleListing,
  cost: UnitCost,
  fee: ChannelFee | null,
  knitwrightFeeBps: number,
  orderId: string | null,
): NewSale | null {
  if (order.brandId === null || cost.status !== "priced" || order.qty < 1) return null;
  const retailMinor = Math.round(order.amountMinor / order.qty);
  const margin = marginFor({ ladder: costLadder(cost.unitMinor, order.currency, cost.label), rates: noRates(order.currency === "AUD" ? "AU" : "GB"), currency: order.currency, qty: order.qty, retailMinor, fee, knitwrightFeeBps });
  const parts = saleParts(margin, order.qty);
  // A sale the fees would take below nothing has no margin to pay; the database refuses it too (`margin_negative`).
  if (parts === null || margin.status !== "priced" || margin.profitMinor < 0) return null;
  return {
    brandId: order.brandId,
    channel: "storefront",
    sourceRef: shopSaleRef(order),
    productId: listing.productId,
    productName: (listing.title || "Storefront product").slice(0, 200),
    quantity: order.qty,
    currency: order.currency,
    ...parts,
    orderId,
  };
}
