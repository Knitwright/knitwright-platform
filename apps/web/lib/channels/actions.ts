"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { getEnv } from "@/lib/config/env";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { readOrdersCsv } from "./csv";
import { takeOrder, type IntakeResult, type ResolvedLine } from "./intake";
import { pushProduct, skuOf } from "./push";
import { channelKey, channelsStore, installDeps, intakeDeps, runTrackingSync, shopifyApp } from "./server";
import { shopDomain } from "./shopify/hmac";
import { authorizeQuery, CALLBACK_PATH, newState, STATE_COOKIE, STATE_SECONDS, stateCookie } from "./shopify/oauth";
import { sumResults, takeShopifyOrder } from "./shopify/orders";
import { shopOf } from "./shopify/install";
import { standInOrderEvent, standInOrderId } from "./shopify/stand-in";
import { receiveShopifyWebhook } from "./shopify/webhooks";
import { termsForProduct, type ProductTerms } from "./terms";
import { log } from "@/lib/server/log";

/**
 * The Channels screen's actions (plan v6 C4, decision 0155). The brand and the person always come from the session;
 * the role is checked here for a clear answer and again inside every database function.
 */

const NOT_SET_UP = "The Shopify app is not set up on this deploy yet. Nothing was connected.";
const NOT_CONNECTED = "Connect a Shopify shop first.";
const PATH = "/store/channels";

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const appOrRefuse = () => {
  const app = shopifyApp();
  if (app === null) throw new AppError("unavailable", NOT_SET_UP);
  return app;
};

/** The brand's own active Shopify connection, with its sealed token. */
async function connectionOf(brandId: string, userId: string) {
  const store = channelsStore();
  const view = (await store.connectionsOf(brandId, userId)).find((one) => one.channel === "shopify");
  const secret = view ? await store.secretById(view.id) : null;
  if (!secret) throw new AppError("conflict", NOT_CONNECTED);
  return secret;
}

/** CONNECT: owners and admins. Sets the signed state cookie and answers where to send the browser. */
export const startShopifyConnectAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({ shop: z.string().min(1).max(120) }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    const app = appOrRefuse();
    const shop = shopDomain(input.shop);
    if (shop === null) throw new AppError("invalid_input", "Type your shop's address, such as my-club.myshopify.com.");
    const state = newState({ brandId: session.brand.id, userId: session.userId, shop }, nowSeconds());
    const jar = await cookies();
    jar.set(STATE_COOKIE, stateCookie(app.secret, state), { httpOnly: true, sameSite: "lax", secure: !app.testMode, path: "/", maxAge: STATE_SECONDS });
    const redirectUri = new URL(CALLBACK_PATH, getEnv().NEXT_PUBLIC_SITE_URL).toString();
    return { url: app.authorizeUrl(shop, authorizeQuery(app.apiKey, redirectUri, state.nonce)) };
  },
});

export const disconnectChannelAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({ connectionId: z.uuid() }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    await channelsStore().disconnect(session.brand.id, session.userId, input.connectionId);
    revalidatePath(PATH);
    return { disconnected: true };
  },
});

/** PUSH: one product, with one retail price for every size. The order gates run first, with the person here. */
export const pushToShopifyAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({ productId: z.uuid(), priceMinor: z.number().int().min(100).max(10_000_000) }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const app = appOrRefuse();
    const who = whoOf(session);
    const connection = await connectionOf(who.brandId, who.userId);
    const product = await termsForProduct({ client: await sessionClient(), admin: adminClient() }, who, session.brand.name, input.productId);
    const store = channelsStore();
    const sizes = await pushProduct(installDeps(app), who, connection, { productId: input.productId, name: product.name, sizes: product.sizes, terms: product.terms }, { priceMinor: input.priceMinor, currency: "GBP" }, await store.listings(who.brandId));
    revalidatePath(PATH);
    return { sizes, fabric: product.terms.fabricKey };
  },
});

/** PULL: paid orders of the last week that a webhook may have missed, and any fulfilment requests waiting. */
export const pullShopifyOrdersAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({}),
  handler: async ({ session }) => {
    requireAbility(session, "manageKit");
    const app = appOrRefuse();
    const connection = await connectionOf(session.brand.id, session.userId);
    const shop = shopOf(channelKey(), connection);
    if (shop === null) throw new AppError("conflict", "The connection to this shop can no longer be read. Disconnect it and connect again.");
    const orders = await app.admin.paidOrdersSince(shop, new Date(Date.now() - 7 * 24 * 3600 * 1000));
    const results: IntakeResult[] = [];
    for (const order of orders) results.push(await takeShopifyOrder(intakeDeps(), connection, order));
    await app.admin.acceptFulfilmentRequests(shop).catch((error: unknown) => log({ level: "error", message: "Fulfilment requests could not be accepted", where: `shopify ${shop.shop}`, error }));
    revalidatePath(PATH);
    return sumResults(results);
  },
});

export const syncTrackingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({}),
  handler: async ({ session }) => {
    requireAbility(session, "manageKit");
    const connection = await connectionOf(session.brand.id, session.userId);
    const result = await runTrackingSync(connection.id);
    if (result === null) throw new AppError("unavailable", NOT_SET_UP);
    revalidatePath(PATH);
    return result;
  },
});

/** CSV IMPORT: every row is checked before any is taken in; each product's gates run once, with the person here. */
export const importOrdersCsvAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({ csv: z.string().min(1).max(256 * 1024) }),
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const read = readOrdersCsv(input.csv);
    if (!read.ok) throw new AppError("invalid_input", read.problems.join(" "));
    const who = whoOf(session);
    const clients = { client: await sessionClient(), admin: adminClient() };
    const terms = new Map<string, ProductTerms>();
    const byOrder = new Map<string, ResolvedLine[]>();
    for (const line of read.lines) {
      if (!terms.has(line.productId)) terms.set(line.productId, await termsForProduct(clients, who, session.brand.name, line.productId));
      const product = terms.get(line.productId)!;
      const size = product.sizes.find((one) => skuOf(line.productId, one) === skuOf(line.productId, line.size));
      if (!size) throw new AppError("invalid_input", `Order ${line.orderRef}: ${product.name} is not made in size ${line.size}.`);
      const lines = byOrder.get(line.orderRef) ?? [];
      lines.push({ brandId: who.brandId, channel: "csv", connectionId: null, externalOrderId: line.orderRef, externalLineId: String(line.lineNo), orderName: `CSV ${line.orderRef}`, productId: line.productId, sizeLabel: size, pieces: line.quantity, shipTo: line.shipTo, projectId: product.projectId, ...product.terms });
      byOrder.set(line.orderRef, lines);
    }
    const results: IntakeResult[] = [];
    for (const [ref, lines] of byOrder) results.push(await takeOrder(intakeDeps(), { brandId: who.brandId, actor: who.userId, description: `CSV order ${ref}`, currency: "GBP", lines }));
    revalidatePath(PATH);
    return sumResults(results);
  },
});

/**
 * TEST ORDER (stand-in only): the `orders/paid` webhook Shopify would send for one piece of the newest listing,
 * signed with the stand-in's secret and handed to the real webhook handler. Refused unless SHOPIFY_APP_TEST_MODE.
 */
export const sendTestShopifyOrderAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: z.object({}),
  handler: async ({ session }) => {
    requireAbility(session, "manageKit");
    const app = appOrRefuse();
    if (!app.testMode) throw new AppError("forbidden", "Test orders exist only on the Shopify stand-in.");
    const connection = await connectionOf(session.brand.id, session.userId);
    const listing = (await channelsStore().listings(session.brand.id)).find((one) => one.connectionId === connection.id);
    if (!listing) throw new AppError("conflict", "Push a product to the shop first.");
    const id = standInOrderId(randomUUID());
    const event = standInOrderEvent(app.secret, {
      id,
      name: `#T${id.slice(-4)}`,
      currency: "GBP",
      lines: [{ id: standInOrderId(`${id}:1`), variantId: listing.externalVariantId, sku: listing.sku, quantity: 1 }],
      shipTo: { name: "Test Buyer", address1: "1 Test Street", address2: "", city: "Leeds", region: "", postcode: "LS1 1AA", country: "GB", phone: "" },
    });
    const answer = await receiveShopifyWebhook({ ...intakeDeps(), secret: app.secret, log }, event.raw, { hmac: event.hmac, topic: "orders/paid", shop: connection.shop });
    if (answer.status !== 200) throw new AppError("internal", answer.message);
    revalidatePath(PATH);
    return { message: answer.message };
  },
});
