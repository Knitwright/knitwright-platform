import "server-only";
import { getEnv } from "@/lib/config/env";
import { submitMakeOrder } from "@/lib/make/service";
import { screenText } from "@/lib/moderation/hooks";
import { moderationDeps } from "@/lib/moderation/server";
import { refundPayment } from "@/lib/payments/refunds";
import { payments, paymentsStore } from "@/lib/payments/server";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import type { BuyDeps } from "./checkout";
import type { CloseDeps } from "./close";
import { supabaseTeamStores } from "./db";
import type { TeamStore } from "./model";

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
  log,
});
