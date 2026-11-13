"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAbility } from "@/lib/clubs/guards";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { handleWebhook } from "@/lib/payments/server";
import { signatureHeader } from "@/lib/payments/signature";
import { refusal } from "@/lib/make/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { isTestAccount, testAccountEvent } from "./connect";
import { describeRun } from "./payout-run";
import { BRANDING_PATH, PAYOUTS_PATH, SETTINGS_PATH, STORE_PATH } from "./routes";
import { connect, dashboardUrl, onboardingUrl, runWeeklyPayouts } from "./server";
import { brandingInput, storeSettingsInput } from "./settings";

/**
 * The seller's Store actions (plan v6 C5, decision 0156): setting up payouts with Stripe Connect, opening the Stripe
 * dashboard, the test onboarding's buttons, the store settings and branding, and ops's weekly run and delivery
 * confirmation. Owners and admins only for the brand's own; platform admins for ops. The database checks the same
 * rules again inside every function.
 */

/** SET UP PAYOUTS: the address of Stripe's onboarding for the brand's Express account. */
export const startPayoutOnboardingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.checkout,
  schema: z.object({}),
  handler: async ({ session }) => {
    requireAbility(session, "manageMembers");
    return { url: await onboardingUrl({ brandId: session.brand.id, userId: session.userId, email: session.email ?? undefined }) };
  },
});

/** OPEN STRIPE: the seller's own Express dashboard, where their bank details and payout history live. */
export const openPayoutDashboardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.checkout,
  schema: z.object({}),
  handler: async ({ session }) => {
    requireAbility(session, "manageMembers");
    return { url: await dashboardUrl(session.brand.id) };
  },
});

/**
 * THE TEST ONBOARDING'S BUTTONS. Only where the test processor is the one; anywhere else the account does not exist.
 * The `account.updated` Stripe would send is made, signed and handed to the same webhook.
 */
export const finishTestOnboardingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.checkout,
  schema: z.object({ accountId: z.string().max(80), complete: z.boolean() }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    const chosen = connect();
    const { data } = await adminClient().from("seller_accounts").select("brand_id").eq("provider_account_id", input.accountId).maybeSingle();
    if (chosen?.provider.name !== "test" || !isTestAccount(input.accountId) || (data as { brand_id?: string } | null)?.brand_id !== session.brand.id) {
      throw new AppError("not_found", "That payout account does not exist.");
    }
    const body = testAccountEvent(input.accountId, input.complete);
    const answer = await handleWebhook(body, signatureHeader(chosen.webhookSecret, body, Math.floor(Date.now() / 1000)));
    if (answer?.status !== 200) throw new AppError("internal", "The test onboarding could not be recorded.");
    revalidatePath(PAYOUTS_PATH);
    return { url: `${PAYOUTS_PATH}?onboarding=back` };
  },
});

/** GPSR and EPR details. */
export const saveStoreSettingsAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.paymentsOps,
  schema: storeSettingsInput,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    const { error } = await adminClient().rpc("set_store_settings", {
      p_actor: session.userId,
      p_brand_id: session.brand.id,
      p_eu_rp_name: input.euRpName,
      p_eu_rp_address: input.euRpAddress,
      p_eu_rp_email: input.euRpEmail,
      p_brand_contact: input.brandContact,
      p_lucid_number: input.lucidNumber,
    });
    if (error) throw refusal(error, "The settings could not be saved.");
    revalidatePath(SETTINGS_PATH);
    return { saved: true };
  },
});

/** One branding choice switched on or off, with its note. */
export const saveBrandingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.paymentsOps,
  schema: brandingInput,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    const { error } = await adminClient().rpc("set_store_branding", { p_actor: session.userId, p_brand_id: session.brand.id, p_option_id: input.optionId, p_on: input.on, p_note: input.note });
    if (error) throw refusal(error, "That branding choice does not exist.");
    revalidatePath(BRANDING_PATH);
    revalidatePath(STORE_PATH);
    return { saved: true };
  },
});

const ops = async () => assertPlatformAdmin(await sessionClient());

/** OPS: run this week's payouts now, as the Friday cron would. */
export const runSellerPayoutsAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.paymentsOps,
  schema: z.object({}),
  handler: async () => {
    await ops();
    const result = await runWeeklyPayouts();
    revalidatePath("/ops/finance");
    return { ...result, message: describeRun(result) };
  },
});

/** OPS: a sale was delivered (a courier scan, the buyer's word), so it pays out at the next run. */
export const confirmSaleDeliveredAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.paymentsOps,
  schema: z.object({ saleId: z.uuid() }),
  handler: async ({ input, session }) => {
    await ops();
    const { error } = await adminClient().rpc("confirm_seller_sale_delivered", { p_actor: session.userId, p_sale_id: input.saleId });
    if (error) throw refusal(error, "That sale does not exist.");
    revalidatePath("/ops/finance");
    return { confirmed: true };
  },
});
