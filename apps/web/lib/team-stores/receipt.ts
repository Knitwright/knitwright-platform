import { formatMoney } from "@/lib/factory/pricing";
import type { TeamStore } from "./model";

/**
 * What a team store buyer reads when they come back from the checkout (decision 0153). Pure, from the payment's
 * state and the store's, so every sentence is tested.
 */

export type BuyerOutcome = Readonly<{ title: string; body: string; tone: "ok" | "info" | "warn" }>;

type Paid = Readonly<{ status: string; amountMinor: number; refundedMinor: number }>;

export function buyerOutcome(payment: Paid, cancelled: boolean, store: Pick<TeamStore, "status" | "currency" | "closesAt" | "minPieces">): BuyerOutcome {
  const money = (minor: number) => formatMoney(minor, store.currency);
  if (payment.status === "refunded" || payment.refundedMinor > 0) {
    return { title: "Refunded", body: `${money(payment.refundedMinor)} is on its way back to your card. Banks take up to 10 days to show it.`, tone: "info" };
  }
  if (payment.status === "paid" || payment.status === "fulfilled") {
    if (store.status === "refunding" || store.status === "refunded") {
      return { title: "Paid, and being refunded", body: "The store did not go ahead, so your payment is being refunded in full.", tone: "info" };
    }
    const closes = new Date(store.closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
    return {
      title: "Paid. Thank you",
      body: `${money(payment.amountMinor)} paid. Your kit is made with the rest of the club's order after the store closes on ${closes}. If fewer than ${store.minPieces} pieces are ordered, you are refunded in full.`,
      tone: "ok",
    };
  }
  if (cancelled || payment.status === "expired") return { title: "Not paid", body: "You left the checkout, so nothing was charged. Go back to the store to order again.", tone: "warn" };
  return { title: "Confirming your payment", body: "The card company has not confirmed the payment yet. Reload this page in a minute.", tone: "info" };
}
