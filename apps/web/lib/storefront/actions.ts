"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadRecord } from "@/lib/brand-studio/service";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { loadPlanView } from "@/lib/collections/server";
import { getEnv } from "@/lib/config/env";
import { creditsService } from "@/lib/credits/server";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { voiceFromRecord, voiceWords } from "@/lib/marketing/copy/voice";
import { screenText } from "@/lib/moderation/hooks";
import { moderationDeps } from "@/lib/moderation/server";
import { handleWebhook, payments, paymentsStore } from "@/lib/payments/server";
import { signatureHeader } from "@/lib/payments/signature";
import { isTestSession, testCheckoutEvent } from "@/lib/payments/test-provider";
import { chooseModels } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { orderPagePath, shopOrderBody, startShopCheckout, tokenOpens } from "./checkout";
import { cancelDrop, insertDrop, listingById, openShopOrder, readListings, readStorefront, setListingStatus, shopOrderById, storefrontBySlug, writeListing, writeStorefront } from "./db";
import { dropFromPlan, newDropBody } from "./drops";
import { blockersOf, canPublish } from "./health";
import { improveListing } from "./improve";
import { applyDraft } from "./listing";
import { listingDraftBody } from "./listing-schema";
import { listingEditorPath } from "./routes";
import { runStorefrontBatches } from "./run";
import { loadListingEditor, newestRelease } from "./server";
import { SLUG_TAKEN, STOREFRONT_PATH, storefrontBody, storefrontWrite } from "./settings";

/**
 * The storefront's actions (plan v6 C3, decision 0154). The brand and the person always come from the session; the
 * role is checked here for a clear answer. A shopper's two actions are public: the listing decides the price, the
 * database refuses anything not on sale, and the test checkout's button needs the shopper's own token.
 */

const NO_PRODUCT = "That product does not exist.";

async function saveDraft(session: Parameters<typeof whoOf>[0], draft: z.output<typeof listingDraftBody>) {
  const data = await loadListingEditor(await sessionClient(), session.brand, draft.productId);
  if (data === null) throw new AppError("not_found", NO_PRODUCT);
  if (draft.fabricKey !== null && data.fabrics.length > 0 && !data.fabrics.includes(draft.fabricKey)) throw new AppError("invalid_input", "Choose one of the fabrics the factory lists.");
  const listing = applyDraft(data.listing, draft, data.sizes);
  const id = await writeListing(adminClient(), listing, session.userId);
  return { id, listing: { ...listing, id } };
}

/** SAVE AS DRAFT. A published listing stays published with its new words; Publish checks it again. */
export const saveListingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: listingDraftBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const saved = await saveDraft(session, input);
    revalidatePath(listingEditorPath(input.productId));
    return { id: saved.id, savedAt: new Date().toISOString() };
  },
});

/** PUBLISH: saves, then publishes only when Listing health has no blocking line. Made from the newest frozen release. */
export const publishListingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: listingDraftBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const saved = await saveDraft(session, input);
    const client = await sessionClient();
    const data = await loadListingEditor(client, session.brand, input.productId);
    if (data === null) throw new AppError("not_found", NO_PRODUCT);
    if (!canPublish(data.health)) throw new AppError("conflict", `Not published yet. ${blockersOf(data.health)}`);
    const releaseId = await newestRelease(client, session.brand.id, data.product.projectId);
    if (releaseId === null) throw new AppError("conflict", "Freeze a version for production first.");
    await setListingStatus(adminClient(), saved.listing, { status: "published", releaseId, userId: session.userId });
    revalidatePath(listingEditorPath(input.productId));
    revalidatePath("/products/mine");
    return { id: saved.id, savedAt: new Date().toISOString() };
  },
});

/** Takes a listing off sale. Orders already paid still go into their batch. */
export const unpublishListingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: z.object({ productId: z.uuid() }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const data = await loadListingEditor(await sessionClient(), session.brand, input.productId);
    if (data === null || data.listing.id === "") throw new AppError("not_found", NO_PRODUCT);
    await setListingStatus(adminClient(), data.listing, { status: "draft", userId: session.userId });
    revalidatePath(listingEditorPath(input.productId));
    return { status: "draft" as const };
  },
});

/** IMPROVE LISTING: new words from the platform's model, metered and charged in credits; never faked. */
export const improveListingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.assistant,
  schema: z.object({ productId: z.uuid(), title: z.string().max(140), description: z.string().max(5000), tags: z.array(z.string().max(30)).max(13) }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const data = await loadListingEditor(client, session.brand, input.productId);
    if (data === null) throw new AppError("not_found", NO_PRODUCT);
    const env = getEnv();
    const primary = env.AI_PROVIDER_STUB === "on" ? null : chooseModels(env).primary;
    const who = whoOf(session);
    const record = await loadRecord(client, { id: session.brand.id, name: session.brand.name }).catch(() => null);
    const price = CREDIT_SETTINGS.prices.marketing_media;
    return improveListing(
      {
        model: primary,
        meter: productionDeps.usage,
        who,
        route: "action improveListing",
        spend: async (hash, usageEventId) => {
          if (!env.CREDITS_ENFORCED) {
            log({ level: "info", message: `Credits not enforced: improving a listing would have cost ${price}`, where: "improveListing" });
            return { ok: true, charged: false, price, balance: 0 };
          }
          return creditsService().spendCredits({ ...who, kind: "marketing_media", designVersionHash: hash, usageEventId });
        },
        giveBack: async (hash) => {
          await creditsService().refundForOrder({ brandId: who.brandId, designVersionHash: hash });
        },
      },
      {
        listingId: data.listing.id || data.product.id,
        productName: data.product.name,
        title: input.title,
        description: input.description,
        tags: input.tags,
        sizes: data.sizes,
        fabric: data.listing.fabricKey,
        personalised: data.listing.personalisation.enabled,
        brandName: session.brand.name,
        voice: record ? voiceWords(voiceFromRecord(record)) : "",
      },
    );
  },
});

/** STOREFRONT SETTINGS: the address, the name, live or not, the returns policy and the EU responsible person. */
export const saveStorefrontAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: storefrontBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const saved = await readStorefront(await sessionClient(), session.brand.id);
    const outcome = await writeStorefront(adminClient(), storefrontWrite(input, session.brand.id, session.userId, saved));
    if (outcome === "slug_taken") throw new AppError("conflict", SLUG_TAKEN);
    revalidatePath(STOREFRONT_PATH);
    return { slug: input.slug, status: input.status };
  },
});

/** A DROP FROM A COLLECTION PLAN: its styles' listings, with the planned pieces as targets. */
export const openStorefrontDropAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: newDropBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const [view, listings] = await Promise.all([loadPlanView(client, session.brand.id, input.collectionId), readListings(client, session.brand.id)]);
    if (view === null) throw new AppError("not_found", "That collection plan does not exist.");
    const plan = dropFromPlan(view.plan, new Map(listings.filter((one) => one.status !== "archived").map((one) => [one.productId, one.id])));
    if (plan.listings.length === 0) throw new AppError("conflict", "No style of this plan has a listing yet. Open a product's listing from My products first.");
    const id = await insertDrop(adminClient(), { brandId: session.brand.id, collectionId: input.collectionId, name: input.name, opensAt: new Date(input.opensAt).toISOString(), closesAt: new Date(input.closesAt).toISOString(), targetUnits: plan.targetUnits, userId: session.userId }, plan.listings);
    revalidatePath(STOREFRONT_PATH);
    return { id, listings: plan.listings.length, left: plan.left.map((one) => `${one.style} ${one.reason}`) };
  },
});

/** Cancels a drop that has not opened yet. */
export const cancelStorefrontDropAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: z.object({ dropId: z.uuid() }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    if (!(await cancelDrop(adminClient(), session.brand.id, input.dropId))) throw new AppError("conflict", "Only a drop that has not opened can be cancelled.");
    revalidatePath(STOREFRONT_PATH);
    return { cancelled: true };
  },
});

/** SEND NOW: this brand's paid made-to-order sales go to production now instead of at Monday's cut-off. */
export const sendStorefrontBatchesAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: z.object({}),
  handler: async ({ session }) => {
    requireAbility(session, "manageKit");
    const now = new Date();
    const run = await runStorefrontBatches(now, session.brand.id, now);
    revalidatePath(STOREFRONT_PATH);
    return run;
  },
});

/** A SHOPPER BUYS: opens the order and its checkout. No account; limited per address. */
export const startShopCheckoutAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.shopCheckout,
  schema: shopOrderBody.extend({ slug: z.string().max(40) }),
  handler: async ({ input }) => {
    const admin = adminClient();
    const [storefront, listing] = await Promise.all([storefrontBySlug(admin, input.slug), listingById(admin, input.listingId)]);
    if (storefront === null || storefront.status !== "live" || listing === null || listing.brandId !== storefront.brandId) throw new AppError("not_found", "That product is not on sale.");
    const chosen = payments();
    return startShopCheckout(
      {
        provider: chosen?.provider ?? null,
        siteUrl: getEnv().NEXT_PUBLIC_SITE_URL,
        open: (body) => openShopOrder(admin, body),
        attach: (paymentId, provider, sessionId) => paymentsStore().attachSession(paymentId, provider, sessionId),
        screen: ({ brandId, text }) => screenText(moderationDeps(null, "storefront-checkout"), { brandId, userId: null, text, context: "name" }),
      },
      { id: listing.id, brandId: listing.brandId, title: listing.title, slug: storefront.slug },
      input,
    );
  },
});

/** THE SHOPPER'S TEST CHECKOUT BUTTONS. Only where the test checkout is the processor, and only with the order's token. */
export const finishShopTestCheckoutAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.shopCheckout,
  schema: z.object({ slug: z.string().max(40), sessionId: z.string().max(80), orderId: z.uuid(), token: z.string().max(64), outcome: z.enum(["paid", "expired"]) }),
  handler: async ({ input }) => {
    const chosen = payments();
    const admin = adminClient();
    const payment = chosen?.provider.name === "test" && isTestSession(input.sessionId) ? await paymentsStore().paymentBySession(input.sessionId) : null;
    const order = await shopOrderById(admin, input.orderId);
    const storefront = await storefrontBySlug(admin, input.slug);
    if (chosen === null || payment === null || order === null || storefront === null || order.paymentId !== payment.id || payment.brandId !== storefront.brandId || !tokenOpens(input.token, order.accessHash)) {
      throw new AppError("not_found", "That checkout does not exist.");
    }
    const body = testCheckoutEvent(
      { sessionId: input.sessionId, paymentId: payment.id, brandId: storefront.brandId, mode: "payment", amountMinor: payment.amountMinor, currency: payment.currency, metadata: { shop_order_id: order.id } },
      input.outcome,
    );
    const answer = await handleWebhook(body, signatureHeader(chosen.webhookSecret, body, Math.floor(Date.now() / 1000)));
    if (answer?.status !== 200) throw new AppError("internal", "The test payment could not be recorded.");
    return { url: `${orderPagePath(storefront.slug, order.id, input.token)}${input.outcome === "paid" ? "" : "&cancelled=1"}` };
  },
});

