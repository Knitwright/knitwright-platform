"use client";

import { startPlanCheckoutAction } from "@/lib/payments/actions";
import type { PlanId } from "@/lib/plans/catalogue";

/**
 * THE PLANS BILLING ENTRY POINT for any button in the app (plan v6 C1, decision 0152): P6's Choose Your Plan modal
 * calls it, and so can G1's "Upgrade to export tech packs". It opens a Stripe Billing checkout for the plan and
 * sends the browser there. Answers the reason in words when it could not, and null once the browser is leaving.
 */
export async function goToPlanCheckout(planId: PlanId, billing: "monthly" | "annual"): Promise<string | null> {
  if (planId === "free") return "Free needs no checkout.";
  const reply = await startPlanCheckoutAction({ planId, billing }).catch(() => null);
  if (!reply) return "The checkout could not be opened. Check your connection and try again.";
  if (!reply.success) return reply.error.message;
  window.location.assign(reply.data.url);
  return null;
}
