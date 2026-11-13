import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refusal } from "@/lib/make/service";
import type { SellerChannel } from "./margin";

/**
 * THE SEAM FOR THE SELLING CHECKOUTS (plan v6 C5, decision 0156). A storefront, drop or team-store checkout (C2,
 * C3) records each paid sale here, with its parts from `saleParts(marginFor(...), quantity)`, so the seller's
 * dashboard, the payouts and the F-G4 liability all read the same rows. Safe to repeat: the sale's reference is the
 * key. A refund is reported as the total refunded so far; a drop that closes into one production order attaches it,
 * so delivery can be seen.
 */

export type NewSale = Readonly<{
  brandId: string;
  channel: SellerChannel;
  /** The selling checkout's own reference, unique across every sale. */
  sourceRef: string;
  productId: string | null;
  productName: string;
  quantity: number;
  currency: "GBP" | "AUD";
  retailMinor: number;
  baseMinor: number;
  shippingMinor: number;
  dutyMinor: number;
  channelFeeMinor: number;
  knitwrightFeeMinor: number;
  /** The production order, when it already exists. */
  orderId: string | null;
}>;

const check = (error: Parameters<typeof refusal>[0] | null, missing: string): void => {
  if (error) throw refusal(error, missing);
};

export async function recordSellerSale(admin: SupabaseClient, sale: NewSale): Promise<string> {
  const { data, error } = await admin.rpc("record_seller_sale", {
    p_brand_id: sale.brandId,
    p_channel: sale.channel,
    p_source_ref: sale.sourceRef,
    p_product_id: sale.productId,
    p_product_name: sale.productName,
    p_quantity: sale.quantity,
    p_currency: sale.currency,
    p_retail_minor: sale.retailMinor,
    p_base_minor: sale.baseMinor,
    p_shipping_minor: sale.shippingMinor,
    p_duty_minor: sale.dutyMinor,
    p_channel_fee_minor: sale.channelFeeMinor,
    p_knitwright_fee_minor: sale.knitwrightFeeMinor,
    p_order_id: sale.orderId,
  });
  check(error, "That brand does not exist.");
  return data as string;
}

export async function attachSaleOrder(admin: SupabaseClient, sourceRef: string, orderId: string): Promise<void> {
  check((await admin.rpc("attach_seller_sale_order", { p_source_ref: sourceRef, p_order_id: orderId })).error, "No sale has that reference.");
}

export async function recordSaleRefund(admin: SupabaseClient, sourceRef: string, refundedTotalMinor: number): Promise<void> {
  check((await admin.rpc("record_seller_sale_refund", { p_source_ref: sourceRef, p_refunded_total_minor: refundedTotalMinor })).error, "No sale has that reference.");
}
