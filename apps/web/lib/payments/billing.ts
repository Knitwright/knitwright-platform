import { PLAN_SETTINGS, type PlanId, type PlanSettings } from "@/lib/plans/catalogue";
import { AppError } from "@/lib/server/core/errors";
import { openSession, type Buyer, type CheckoutDeps } from "./checkout";

/**
 * PLANS AND CREDITS (plan v6 C1, decision 0152; P6's plans modal, decision 0144).
 *
 * A plan is a Stripe Billing subscription made through Checkout with the price written into the session, so no
 * price has to be created in Stripe first: the price is P6's plan row (still labelled placeholder until the owner
 * sets prices). Monthly is the plan's monthly price; annual is twelve of its annual monthly price, billed yearly.
 * The plan's credits are given when the checkout is paid and again on every renewal (`webhook.ts`).
 *
 * A credit pack is a one-off payment whose credits go into the existing ledger (`credit_grant`, keyed by the
 * payment, so a webhook delivered twice gives them once). No pack price exists in the spec: each pack is priced at
 * the Starter plan's own rate per credit (P6's placeholder rows), labelled, until the owner sets packs (C1-4).
 */

export type Billing = "monthly" | "annual";

export interface CreditPack {
  readonly id: string;
  readonly credits: number;
  readonly priceMinor: number;
}

export const CREDIT_PACK_SIZES = [500, 2000, 5000] as const;

/** The packs, priced at the Starter plan's rate per credit, rounded up to a whole penny. */
export function creditPacks(settings: PlanSettings = PLAN_SETTINGS): readonly CreditPack[] {
  const starter = settings.plans.find((plan) => plan.id === "starter");
  if (!starter || starter.credits === 0) return [];
  return CREDIT_PACK_SIZES.map((credits) => ({ id: `pack_${credits}`, credits, priceMinor: Math.ceil((starter.monthlyMinor * credits) / starter.credits) }));
}

export const CREDIT_PACK_LABEL = "Placeholder pack prices: each is the Starter plan's placeholder rate per credit, until packs are priced.";

export type PlanCharge = Readonly<{ planId: PlanId; interval: "month" | "year"; amountMinor: number; name: string; credits: number }>;

/** What a plan costs for the billing period chosen. Free is not bought. */
export function planCharge(planId: PlanId, billing: Billing, settings: PlanSettings = PLAN_SETTINGS): PlanCharge {
  const plan = settings.plans.find((row) => row.id === planId);
  if (!plan || plan.monthlyMinor === 0) throw new AppError("invalid_input", "That plan is not one you can buy.");
  return billing === "monthly"
    ? { planId, interval: "month", amountMinor: plan.monthlyMinor, name: `Knitwright ${plan.name}, monthly`, credits: plan.credits }
    : { planId, interval: "year", amountMinor: plan.annualMonthlyMinor * 12, name: `Knitwright ${plan.name}, yearly`, credits: plan.credits };
}

/** The credits a plan gives each period, or 0 for a plan that does not exist. */
export const planCredits = (planId: string, settings: PlanSettings = PLAN_SETTINGS): number => settings.plans.find((plan) => plan.id === planId)?.credits ?? 0;

/** Starts a plan's checkout. Returns where to send the person. */
export async function startPlanCheckout(deps: CheckoutDeps, buyer: Buyer, planId: PlanId, billing: Billing): Promise<string> {
  const charge = planCharge(planId, billing);
  const paymentId = await deps.store.open({
    brandId: buyer.brandId,
    userId: buyer.userId,
    purpose: "plan",
    method: "card",
    currency: "GBP",
    orderValueMinor: null,
    amountMinor: charge.amountMinor,
    schedule: "full",
    description: charge.name,
    credits: null,
    planId: charge.planId,
    planInterval: charge.interval,
    lines: [],
  });
  return openSession(deps, {
    paymentId,
    brandId: buyer.brandId,
    mode: "subscription",
    currency: "GBP",
    amountMinor: charge.amountMinor,
    interval: charge.interval,
    name: charge.name,
    customerEmail: buyer.email,
    metadata: { plan_id: charge.planId, plan_interval: charge.interval },
  });
}

/** Starts a credit pack's checkout. Returns where to send the person. */
export async function startCreditCheckout(deps: CheckoutDeps, buyer: Buyer, packId: string): Promise<string> {
  const pack = creditPacks().find((one) => one.id === packId);
  if (!pack) throw new AppError("invalid_input", "That credit pack does not exist.");
  const name = `${pack.credits.toLocaleString("en-GB")} Knitwright credits`;
  const paymentId = await deps.store.open({
    brandId: buyer.brandId,
    userId: buyer.userId,
    purpose: "credits",
    method: "card",
    currency: "GBP",
    orderValueMinor: null,
    amountMinor: pack.priceMinor,
    schedule: "full",
    description: name,
    credits: pack.credits,
    planId: null,
    planInterval: null,
    lines: [],
  });
  return openSession(deps, { paymentId, brandId: buyer.brandId, mode: "payment", currency: "GBP", amountMinor: pack.priceMinor, name, customerEmail: buyer.email });
}
