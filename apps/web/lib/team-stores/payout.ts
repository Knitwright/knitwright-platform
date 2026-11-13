import { noRates } from "@/lib/collections/landed";
import type { Ladder } from "@/lib/factory/pricing";
import { marginFor, saleParts, type ChannelFee } from "@/lib/store-pages/margin";
import type { NewSale } from "@/lib/store-pages/sales";
import type { StorePurchase, TeamStore } from "./model";
import { piecePriceMinor } from "./rules";

/**
 * THE CLUB'S MARGIN AS A SELLER SALE (plan v6 C2 on C5, decisions 0153 and 0156). When a store closes into its order,
 * every counted purchase is recorded through C5's `record_seller_sale`, so the club margin reaches C5's weekly payouts
 * (after delivery) and the seller dashboard, instead of only sitting on the store row.
 *
 * The figures are C5's own margin calculator (`marginFor`, then `saleParts`), fed with what the store fixed when it
 * opened: retail is the price a buyer paid a piece, the base is the store's base price (one tier holding that price,
 * so the calculator reads exactly it), no freight or duty (the order goes as one delivery to the club, inside the
 * base price), the `team_store` channel fee row and the payout setting's Knitwright fee. A store with no margin, or
 * whose margin the fees would take below nothing, records no sale: there is nothing to pay the club.
 */

export const saleRef = (purchase: Pick<StorePurchase, "paymentId">): string => `team-store:${purchase.paymentId}`;

/** One tier holding the store's own base price, so the calculator prices every quantity at it. */
const storeLadder = (store: TeamStore): Ladder => [
  {
    id: store.id,
    capabilityId: store.id,
    qtyMin: 1,
    qtyMax: null,
    cost: null,
    sellGbpMinor: store.currency === "GBP" ? store.unitMinor : null,
    sellAudMinor: store.currency === "AUD" ? store.unitMinor : null,
    personalisationCostMinor: null,
    ruleId: "R-GAP-000",
    label: store.priceLabel,
  },
];

export function storeSale(store: TeamStore, purchase: StorePurchase, fee: ChannelFee | null, knitwrightFeeBps: number, orderId: string | null): NewSale | null {
  if (store.marginBps === 0) return null;
  const margin = marginFor({ ladder: storeLadder(store), rates: noRates(store.currency === "AUD" ? "AU" : "GB"), currency: store.currency, qty: purchase.pieces, retailMinor: piecePriceMinor(store), fee, knitwrightFeeBps });
  const parts = saleParts(margin, purchase.pieces);
  if (parts === null || margin.status !== "priced" || margin.profitMinor < 0) return null;
  return {
    brandId: store.brandId,
    channel: "team_store",
    sourceRef: saleRef(purchase),
    productId: store.productId,
    productName: store.title,
    quantity: purchase.pieces,
    currency: store.currency,
    ...parts,
    orderId,
  };
}
