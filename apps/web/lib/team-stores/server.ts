import "server-only";
import { getEnv } from "@/lib/config/env";
import { submitMakeOrder } from "@/lib/make/service";
import { screenText } from "@/lib/moderation/hooks";
import { moderationDeps } from "@/lib/moderation/server";
import { refundPayment } from "@/lib/payments/refunds";
import { payments, paymentsStore } from "@/lib/payments/server";
import { AppError } from "@/lib/server/core/errors";
import { adminClient } from "@/lib/server/deps";
import type { ChannelFee } from "@/lib/store-pages/margin";
import { attachSaleOrder, recordSaleRefund, recordSellerSale } from "@/lib/store-pages/sales";
import { log } from "@/lib/server/log";
import type { BuyDeps } from "./checkout";
import type { CloseDeps } from "./close";
import { supabaseTeamStores } from "./db";
import type { StorePurchase, TeamStore } from "./model";
import { saleRef, storeSale } from "./payout";

/**
 * The team store rules wired to the database, C1's processor and refunds, the make flow's door, moderation and
 * the log (plan v6 C2, decision 0153). No rules live here; the database and browser tests cover the joins.
 */

export const teamStores = () => supabaseTeamStores(adminClient());

export const buyDeps = (): BuyDeps => ({
  stores: teamStores(),
  payments: paymentsStore(),
  provider: payments()?.provider ?? null,
  siteUrl: getEnv().NEXT_PUBLIC_SITE_URL,
  screenName: async ({ brandId, text }) => {
    const verdict = await screenText(moderationDeps(null, "team-store"), { brandId, userId: null, text, context: "name" });
    const block = verdict.reasons.find((reason) => reason.severity === "block");
    return { blocked: verdict.result === "blocked", message: block?.message ?? null };
  },
  now: () => new Date(),
});

/** The note ops reads with the order: where the names and numbers are. */
export const storeFlag = (store: TeamStore) => ({
  code: "team_store",
  text: `Team store "${store.title}" (${store.code}): ${store.piecesSold ?? 0} pieces, one delivery to the club. Names and numbers are in the club's store list.`.slice(0, 300),
});

/** The team store's channel fee row and the payout setting's Knitwright fee (C5, decision 0156). */
async function feesFor(currency: TeamStore["currency"]): Promise<Readonly<{ fee: ChannelFee | null; knitwrightFeeBps: number }>> {
  const admin = adminClient();
  const [fee, settings] = await Promise.all([
    admin.from("seller_channel_fees").select("percent_bps, fixed_minor, label, is_placeholder").eq("channel", "team_store").eq("currency", currency).maybeSingle(),
    admin.from("seller_payout_settings").select("knitwright_fee_bps").eq("id", true).maybeSingle(),
  ]);
  if (fee.error || settings.error) throw new AppError("internal", "The payout fees could not be read.", undefined, { cause: fee.error ?? settings.error });
  const row = fee.data as { percent_bps: number; fixed_minor: number; label: string; is_placeholder: boolean } | null;
  return {
    fee: row === null ? null : { channel: "team_store", currency, percentBps: row.percent_bps, fixedMinor: Number(row.fixed_minor), label: row.label, isPlaceholder: row.is_placeholder },
    knitwrightFeeBps: (settings.data as { knitwright_fee_bps?: number } | null)?.knitwright_fee_bps ?? 0,
  };
}

/** A sale this store never recorded (no margin, or its fees left nothing) answers "not found": nothing to report. */
const unlessMissing = (error: unknown): void => {
  if (!(error instanceof AppError) || error.code !== "not_found") throw error;
};

const sales: CloseDeps["sales"] = {
  record: async (store: TeamStore, purchase: StorePurchase, orderId: string | null) => {
    const { fee, knitwrightFeeBps } = await feesFor(store.currency);
    const sale = storeSale(store, purchase, fee, knitwrightFeeBps, orderId);
    if (sale === null) return;
    await recordSellerSale(adminClient(), sale);
    if (orderId !== null) await attachSaleOrder(adminClient(), sale.sourceRef, orderId);
  },
  refund: async (purchase, refundedTotalMinor) => {
    await recordSaleRefund(adminClient(), saleRef(purchase), refundedTotalMinor).catch(unlessMissing);
  },
};

export const closeDeps = (): CloseDeps => ({
  stores: teamStores(),
  submit: async (store, who) => {
    const sent = await submitMakeOrder(adminClient(), who, {
      productId: store.productId,
      kind: "run",
      releaseId: store.releaseId,
      factoryProfileId: store.factoryProfileId,
      fabricKey: store.fabricKey,
      sizes: store.closeSizes ?? {},
      flags: [...store.flags, storeFlag(store)],
      requestKey: store.closeRequestKey ?? "",
    });
    return { orderId: sent.orderId, runId: sent.runId };
  },
  payment: (paymentId) => paymentsStore().payment(paymentId),
  refund: async (payment, amountMinor, reason) => {
    await refundPayment({ store: paymentsStore(), provider: payments()?.provider ?? null }, payment, amountMinor, reason, null);
  },
  sales,
  log,
});
