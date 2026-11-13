"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { startCreditCheckout, startPlanCheckout } from "./billing";
import { refundPayment } from "./refunds";
import { checkoutDeps, handleWebhook, payments, paymentsStore } from "./server";
import { signatureHeader } from "./signature";
import { isTestSession, testCheckoutEvent } from "./test-provider";

/**
 * The payments actions (plan v6 C1, decision 0152): buying a plan or credits, the test checkout's two buttons, and
 * the ops finance page's refund, deposit and settings. Order checkouts start inside each order door's own action
 * (`lib/make/actions.ts`, `lib/brand-runs/actions.ts`, `lib/collections/actions.ts`), after that door's refusals.
 */

const buyerOf = (session: Parameters<typeof whoOf>[0]) => ({ ...whoOf(session), email: session.email ?? undefined });

/**
 * BUY A PLAN (P6's plans modal, decision 0144; G1's "Upgrade to export tech packs"). Answers the address of the
 * checkout to send the person to. Owners and admins only.
 */
export const startPlanCheckoutAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.checkout,
  schema: z.object({ planId: z.enum(["starter", "studio_pro", "club_scale"]), billing: z.enum(["monthly", "annual"]) }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    return { url: await startPlanCheckout(checkoutDeps(), buyerOf(session), input.planId, input.billing) };
  },
});

/** BUY CREDITS into the existing ledger. Owners and admins only. */
export const startCreditCheckoutAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.checkout,
  schema: z.object({ packId: z.string().regex(/^pack_\d{1,7}$/) }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    return { url: await startCreditCheckout(checkoutDeps(), buyerOf(session), input.packId) };
  },
});

/**
 * THE TEST CHECKOUT'S BUTTONS. Only where the test checkout is the processor; anywhere else the session does not
 * exist. The event is made, signed with the test secret and handed to the same webhook Stripe's endpoint uses.
 */
export const finishTestCheckoutAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.checkout,
  schema: z.object({ sessionId: z.string().max(80), outcome: z.enum(["paid", "expired"]) }),
  handler: async ({ input, session }) => {
    const chosen = payments();
    const payment = chosen?.provider.name === "test" && isTestSession(input.sessionId) ? await paymentsStore().paymentBySession(input.sessionId) : null;
    if (chosen === null || payment === null || payment.brandId !== session.brand.id) throw new AppError("not_found", "That checkout does not exist.");
    const body = testCheckoutEvent(
      {
        sessionId: input.sessionId,
        paymentId: payment.id,
        brandId: payment.brandId,
        mode: payment.purpose === "plan" ? "subscription" : "payment",
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        metadata: payment.planId ? { plan_id: payment.planId } : {},
      },
      input.outcome,
    );
    const answer = await handleWebhook(body, signatureHeader(chosen.webhookSecret, body, Math.floor(Date.now() / 1000)));
    if (answer?.status !== 200) throw new AppError("internal", "The test payment could not be recorded.");
    return { url: `/checkout/return?payment=${payment.id}${input.outcome === "paid" ? "" : "&cancelled=1"}` };
  },
});

const ops = async () => assertPlatformAdmin(await sessionClient());

const refresh = () => revalidatePath("/ops/finance");

/** OPS: give back part or all of a card payment. */
export const refundPaymentAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.paymentsOps,
  schema: z.object({ paymentId: z.uuid(), amountMinor: z.number().int().positive().max(100_000_000), reason: z.string().trim().min(1).max(300) }),
  handler: async ({ input, session }) => {
    await ops();
    const payment = await paymentsStore().payment(input.paymentId);
    if (payment === null) throw new AppError("not_found", "That payment does not exist.");
    const done = await refundPayment({ store: paymentsStore(), provider: payments()?.provider ?? null }, payment, input.amountMinor, input.reason, session.userId);
    refresh();
    return done;
  },
});

/** OPS: record a deposit sent to a factory. The database refuses one over the F-G4 headroom. */
export const recordFactoryDepositAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.paymentsOps,
  schema: z.object({
    factoryProfileId: z.string().trim().min(1).max(120),
    currency: z.enum(["GBP", "AUD"]),
    amountMinor: z.number().int().positive().max(100_000_000),
    note: z.string().trim().min(1).max(300),
  }),
  handler: async ({ input, session }) => {
    await ops();
    const { data, error } = await adminClient().rpc("record_factory_deposit", {
      p_actor: session.userId,
      p_factory_profile_id: input.factoryProfileId,
      p_currency: input.currency,
      p_amount_minor: input.amountMinor,
      p_note: input.note,
    });
    if (error) throw new AppError(error.code === "P0001" ? "conflict" : "internal", error.code === "P0001" ? error.message : "The deposit could not be recorded.");
    refresh();
    return { id: data as string };
  },
});

/** OPS: the refund reserve, the deposit rule and what an unpriced order does. */
export const savePaymentSettingsAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.paymentsOps,
  schema: z.object({
    refundReserveBps: z.number().int().min(0).max(10_000),
    depositBps: z.number().int().min(1).max(9_999),
    depositThresholdGbpMinor: z.number().int().positive().nullable(),
    depositThresholdAudMinor: z.number().int().positive().nullable(),
    unpricedOrders: z.enum(["invoice", "refuse"]),
    label: z.string().trim().min(1).max(300),
  }),
  handler: async ({ input, session }) => {
    await ops();
    const { error } = await adminClient().rpc("set_payment_settings", {
      p_actor: session.userId,
      p_refund_reserve_bps: input.refundReserveBps,
      p_deposit_bps: input.depositBps,
      p_deposit_threshold_gbp_minor: input.depositThresholdGbpMinor,
      p_deposit_threshold_aud_minor: input.depositThresholdAudMinor,
      p_unpriced_orders: input.unpricedOrders,
      p_label: input.label,
    });
    if (error) throw new AppError("internal", "The settings could not be saved.");
    refresh();
    return { saved: true };
  },
});
