import "server-only";
import { z } from "zod";
import { ladderForArticle, loadFactoryFacts } from "@/lib/order-desk/server";
import { AppError } from "@/lib/server/core/errors";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import type { ChannelFee } from "@/lib/store-pages/margin";
import { attachSaleOrder, recordSaleRefund, recordSellerSale } from "@/lib/store-pages/sales";
import { shopSale, shopSaleRef } from "./payout";
import { unitCost, type UnitCost } from "./pricing";
import { SHOP_ORDER_COLUMNS, toShopOrder } from "./rows";

/**
 * Storefront sales into C5's payouts (decisions 0154 and 0156), joined to the shop orders, the listing's cost and
 * C5's fee rows. Run after every batch run and after a shopper pays. Every call is safe to repeat: a sale is keyed
 * on its shop order, attaching the same order again changes nothing, and a refund is reported as its running total.
 * The rules are `payout.ts`; the database and browser tests cover these joins.
 */

const LOOK_BACK_DAYS = 120;

const joined = z
  .object({
    order_payments: z.object({ status: z.string(), refunded_minor: z.coerce.number().int() }),
    storefront_batches: z.object({ status: z.string(), order_id: z.uuid().nullable() }).nullable(),
    listings: z.object({ product_id: z.uuid(), title: z.string() }).nullable(),
  })
  .loose();

type Currency = "GBP" | "AUD";

async function feesFor(currency: Currency): Promise<Readonly<{ fee: ChannelFee | null; knitwrightFeeBps: number }>> {
  const admin = adminClient();
  const [fee, settings] = await Promise.all([
    admin.from("seller_channel_fees").select("percent_bps, fixed_minor, label, is_placeholder").eq("channel", "storefront").eq("currency", currency).maybeSingle(),
    admin.from("seller_payout_settings").select("knitwright_fee_bps").eq("id", true).maybeSingle(),
  ]);
  if (fee.error || settings.error) throw new AppError("internal", "The payout fees could not be read.", undefined, { cause: fee.error ?? settings.error });
  const row = fee.data as { percent_bps: number; fixed_minor: number; label: string; is_placeholder: boolean } | null;
  return {
    fee: row === null ? null : { channel: "storefront", currency, percentBps: row.percent_bps, fixedMinor: Number(row.fixed_minor), label: row.label, isPlaceholder: row.is_placeholder },
    knitwrightFeeBps: (settings.data as { knitwright_fee_bps?: number } | null)?.knitwright_fee_bps ?? 0,
  };
}

/** The listing's production cost per piece, as the editor shows it, cached per product and currency. */
function costReader(): (productId: string, currency: Currency) => Promise<UnitCost> {
  const cache = new Map<string, Promise<UnitCost>>();
  return (productId, currency) => {
    const key = `${productId}:${currency}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const { data } = await adminClient().from("brand_products").select("projects(garment_type)").eq("id", productId).maybeSingle();
        const type = (data as { projects?: { garment_type?: string } | null } | null)?.projects?.garment_type ?? null;
        const facts = await loadFactoryFacts(currency);
        return unitCost(type ? ladderForArticle(facts.snapshot, type) : [], currency);
      })());
    }
    return cache.get(key)!;
  };
}

const unlessMissing = (error: unknown): void => {
  if (!(error instanceof AppError) || error.code !== "not_found") throw error;
};

/** Records every paid storefront order of the last few months as a seller sale, with its order and its refunds. */
export async function syncShopSales(brandId?: string): Promise<number> {
  const admin = adminClient();
  const since = new Date(Date.now() - LOOK_BACK_DAYS * 86_400_000).toISOString();
  const query = admin
    .from("shop_orders")
    .select(`${SHOP_ORDER_COLUMNS}, order_payments!inner(status, refunded_minor), storefront_batches(status, order_id), listings(product_id, title)`)
    .in("order_payments.status", ["paid", "fulfilled", "refunded"])
    .gte("created_at", since);
  const { data, error } = await (brandId ? query.eq("brand_id", brandId) : query);
  if (error) throw new AppError("internal", "The storefront orders could not be read.", undefined, { cause: error });
  const costOf = costReader();
  const fees = new Map<Currency, Awaited<ReturnType<typeof feesFor>>>();
  let recorded = 0;
  for (const raw of data ?? []) {
    const order = toShopOrder(raw);
    const extra = joined.parse(raw);
    if (extra.listings === null) continue;
    try {
      if (!fees.has(order.currency)) fees.set(order.currency, await feesFor(order.currency));
      const { fee, knitwrightFeeBps } = fees.get(order.currency)!;
      const productionOrder = extra.storefront_batches?.status === "sent" ? extra.storefront_batches.order_id : null;
      const sale = shopSale(order, { productId: extra.listings.product_id, title: extra.listings.title }, await costOf(extra.listings.product_id, order.currency), fee, knitwrightFeeBps, productionOrder);
      if (sale === null) continue;
      await recordSellerSale(admin, sale);
      if (productionOrder !== null) await attachSaleOrder(admin, shopSaleRef(order), productionOrder);
      if (extra.order_payments.refunded_minor > 0) await recordSaleRefund(admin, shopSaleRef(order), extra.order_payments.refunded_minor).catch(unlessMissing);
      recorded += 1;
    } catch (failure) {
      log({ level: "error", message: "A storefront sale could not be recorded for payouts; the next run tries again", where: `shop order ${order.id}`, error: failure });
    }
  }
  return recorded;
}
