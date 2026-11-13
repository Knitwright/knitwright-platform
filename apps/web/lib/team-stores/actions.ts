"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { can } from "@/lib/clubs/roles";
import { listSeasons } from "@/lib/clubs/service";
import { readZoneLimits } from "@/lib/clubs/signup/service";
import { NAME_ZONE, limitOf } from "@/lib/clubs/signup/zones";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { whyNoRun } from "@/lib/make/gate";
import { orderValidationGate } from "@/lib/make/order-gate";
import { loadMake } from "@/lib/make/server";
import { carryOver } from "@/lib/make/service";
import { GAP_RULE_ID } from "@/lib/make/vocabulary";
import { guardOrder } from "@/lib/moderation/before-order";
import { humanReviewGate, orderGate } from "@/lib/moderation/server";
import { handleWebhook, payments, paymentsStore } from "@/lib/payments/server";
import { signatureHeader } from "@/lib/payments/signature";
import { isTestSession, testCheckoutEvent } from "@/lib/payments/test-provider";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { verifyBotCheck } from "@/lib/share/turnstile";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { startStoreCheckout } from "./checkout";
import { closeStore } from "./close";
import { newStoreCode } from "./code";
import { clubPageAddress } from "./host";
import { planStore } from "./plan";
import { listPurchases, listStores, readBuyerPayment, readClubPage } from "./reads";
import { buySchema, clubPageSchema, endStoreSchema, openStoreSchema, projectStoresSchema, testPaySchema, windowOf } from "./schemas";
import { buyDeps, closeDeps, teamStores } from "./server";
import { storeCard } from "./view";

/**
 * Team stores and club pages (plan v6 C2, decision 0153). A club's actions take the club and the person from the
 * session and never from the form; the database checks the person's role itself. A buyer's actions need no
 * session: they are limited per address, the purchase is guarded by the bot check, and the shirt names are
 * screened before anything is kept.
 */

type Session = Parameters<typeof whoOf>[0];

const refresh = (): void => revalidatePath("/team");

const siteUrl = (): string => getEnv().NEXT_PUBLIC_SITE_URL;

/** The Order drawer's Team store tab: this design's stores, the seasons a roster can come from, and the club page. */
export const loadDesignStoresAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: projectStoresSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const [stores, seasons, page] = await Promise.all([listStores(client, session.brand.id, input.projectId), listSeasons(client, session.brand.id), readClubPage(client, session.brand.id)]);
    const purchases = await listPurchases(client, stores.map((store) => store.id));
    const now = new Date();
    return {
      stores: stores.map((store) => storeCard(store, purchases.get(store.id) ?? [], now, siteUrl())),
      seasons: seasons.map((season) => ({ id: season.id, name: season.name })),
      clubPage: page === null ? null : { ...page, address: clubPageAddress(page.slug, getEnv().CLUB_PAGES_DOMAIN, siteUrl()) },
      canEdit: can(session.brand.role, "manageKit"),
    };
  },
});

/** The content screen and the Class B review for the release the store sells, as every order door runs them. */
async function screenStore(session: Session, label: string, context: Awaited<ReturnType<typeof loadMake>>, releaseId: string) {
  const who = whoOf(session);
  if (context.gate.status !== "blocked" && context.gate.carriedOver) {
    await carryOver(adminClient(), who, { goldenSampleId: context.gate.goldenSampleId, toVersion: context.currentVersion, changed: context.gate.changed, ruleId: GAP_RULE_ID });
  }
  const guarded = await guardOrder(
    { order: orderGate({ brandId: who.brandId, userId: who.userId }, "team store"), humanReview: humanReviewGate() },
    { releaseId, label: `${label} (team store)`, assetIds: context.moderationAssetIds, texts: [{ text: label, context: "title" }], classB: context.productionClass === "B" },
  );
  return guarded.result;
}

/**
 * OPENS A TEAM STORE from the design (F-T6 step 1). Every check a run order meets runs now, before anyone pays:
 * the golden sample, the D1 validation gate, the content screen. The database runs the payment and validation
 * gates again when the store closes into its order.
 */
export const openTeamStoreAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: openStoreSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const who = whoOf(session);
    const [context, zones] = await Promise.all([loadMake(client, who.brandId, input.projectId, "GBP"), readZoneLimits(adminClient())]);
    const release = context.releases[0] ?? null;
    const planned = planStore(
      {
        ...who,
        projectId: context.projectId,
        productId: context.product?.id ?? null,
        releaseId: release?.id ?? null,
        factoryProfileId: context.factory.profileId,
        fabricKey: context.fabricKey,
        ladder: context.factory.ladder,
        sizeRun: context.sizeRun,
        nameMax: limitOf(zones, NAME_ZONE)?.maxCharacters ?? null,
        whyNoRun: whyNoRun(context.gate),
      },
      { ...input, ...windowOf(input, new Date()) },
      newStoreCode(),
      [],
    );
    const gate = orderValidationGate({ client, admin: adminClient(), who, brandName: session.brand.name, country: "GB" });
    const flags = await gate(
      { projectId: context.projectId, releaseId: planned.releaseId, productionClass: context.productionClass, colourToleranceMax: context.factory.colourDeltaMax },
      () => screenStore(session, input.title, context, planned.releaseId),
    );
    const id = await teamStores().openStore({ ...planned, flags });
    refresh();
    return { id };
  },
});

/** Closes a store now (its orders become the club's order) or cancels it (everyone who paid is refunded). */
export const endTeamStoreAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: endStoreSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await teamStores().endStore(whoOf(session), input.storeId, input.how);
    const result = await closeStore(closeDeps(), input.storeId);
    refresh();
    return { status: result.status };
  },
});

/** The club page's address, contact line and whether it is published. */
export const saveClubPageAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: clubPageSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const who = whoOf(session);
    const { error } = await adminClient().rpc("set_club_page", { p_brand_id: who.brandId, p_user_id: who.userId, p_slug: input.slug, p_contact: input.contact, p_published: input.published });
    if (error) {
      if (error.code === "42501") throw new AppError("forbidden", error.message);
      if (error.code === "22023" || error.code === "P0001") throw new AppError("invalid_input", MESSAGES.invalid_input, { slug: [error.message] });
      throw new AppError("internal", "The club page could not be saved.", undefined, { cause: error });
    }
    refresh();
    return { address: clubPageAddress(input.slug, getEnv().CLUB_PAGES_DOMAIN, siteUrl()) };
  },
});

const TRY_LATER = "We could not take that just now. Try again in a few minutes.";

/** The bot check, as the roster sign-up runs it. Without a secret nothing is taken. */
async function passBotCheck(token: string): Promise<void> {
  const secret = turnstileSecret(getEnv());
  if (secret === null) throw new AppError("unavailable", TRY_LATER);
  const outcome = await verifyBotCheck({ secret, token, address: await productionDeps.getClientAddress(), send: fetch });
  if (outcome === "unreachable") throw new AppError("unavailable", TRY_LATER);
  if (outcome === "failed") throw new AppError("invalid_input", MESSAGES.invalid_input, { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] });
}

/** A player or parent buys from a store with no account (F-T6 step 2). Answers the checkout's address. */
export const buyFromStoreAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.teamStoreBuy,
  schema: buySchema,
  handler: async ({ input }) => {
    await passBotCheck(input[CAPTCHA_FIELD]);
    return startStoreCheckout(buyDeps(), {
      code: input.code,
      requestKey: input.requestKey,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      lines: input.lines.map((line) => ({ sizeLabel: line.size, printName: line.name, printNumber: line.number })),
    });
  },
});

/**
 * THE TEST CHECKOUT'S BUTTONS for a store buyer (CI, a local run). Only where the test checkout is the processor,
 * and only for a team store payment of this store; the event goes to the same webhook Stripe's endpoint uses.
 */
export const finishStoreTestCheckoutAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.teamStoreBuy,
  schema: testPaySchema,
  handler: async ({ input }) => {
    const chosen = payments();
    const payment = chosen?.provider.name === "test" && isTestSession(input.sessionId) ? await paymentsStore().paymentBySession(input.sessionId) : null;
    const store = payment?.purpose === "team_store" ? await teamStores().storeByCode(input.code) : null;
    const owned = store !== null && payment !== null ? await readBuyerPayment(adminClient(), store.id, payment.id) : null;
    if (chosen === null || payment === null || store === null || owned === null) throw new AppError("not_found", "That checkout does not exist.");
    const body = testCheckoutEvent(
      { sessionId: input.sessionId, paymentId: payment.id, brandId: store.brandId, mode: "payment", amountMinor: payment.amountMinor, currency: payment.currency, metadata: { team_store_id: store.id } },
      input.outcome,
    );
    const answer = await handleWebhook(body, signatureHeader(chosen.webhookSecret, body, Math.floor(Date.now() / 1000)));
    if (answer?.status !== 200) throw new AppError("internal", "The test payment could not be recorded.");
    return { url: `/t/${input.code}/done?payment=${payment.id}${input.outcome === "paid" ? "" : "&cancelled=1"}` };
  },
});
