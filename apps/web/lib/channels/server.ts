import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listProducts } from "@/lib/brand-runs/service";
import { can, type ClubRole } from "@/lib/clubs/roles";
import { getEnv } from "@/lib/config/env";
import { loadOrderProducts } from "@/lib/make/server";
import { fulfil } from "@/lib/payments/server";
import { paymentsStore } from "@/lib/payments/server";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { supabaseChannels } from "./db";
import type { IntakeDeps } from "./intake";
import type { InstallDeps } from "./shopify/install";
import { shopOf } from "./shopify/install";
import { shopifyFrom, type ShopifyApp } from "./shopify/select";
import { receiveShopifyWebhook, type WebhookAnswer, type WebhookHeaders } from "./shopify/webhooks";
import { tokenKey } from "./token-crypto";
import { syncTracking, type TrackingResult } from "./tracking";
import { channelProducts, withNames, type ChannelsPage, type ShopifyState } from "./view";

/**
 * The channels code wired to the database, the Shopify chosen by the environment, C1's payments and the log (plan
 * v6 C4, decision 0155). No rules live here; the database and browser tests cover the joins.
 */

export const shopifyApp = (): ShopifyApp | null => shopifyFrom(getEnv());

export const channelKey = (): Buffer => tokenKey(getEnv().CHANNEL_TOKEN_KEY, getEnv().SUPABASE_SECRET_KEY);

export const channelsStore = () => supabaseChannels(adminClient());

export const intakeDeps = (): IntakeDeps => ({
  store: channelsStore(),
  openInvoice: (input) =>
    paymentsStore().open({
      brandId: input.brandId,
      userId: input.userId,
      purpose: "order",
      method: "invoice",
      currency: input.currency,
      orderValueMinor: null,
      amountMinor: 0,
      schedule: "full",
      description: input.description.slice(0, 300),
      credits: null,
      planId: null,
      planInterval: null,
      lines: input.lines,
    }),
  fulfil,
  paymentLines: (paymentId) => paymentsStore().lines(paymentId),
});

export const installDeps = (app: ShopifyApp): InstallDeps => ({ store: channelsStore(), admin: app.admin, key: channelKey(), siteUrl: getEnv().NEXT_PUBLIC_SITE_URL, log });

/** The webhook, with this deploy's app secret. Without a Shopify app nothing is read: null (503). */
export async function handleShopifyWebhook(raw: string, headers: WebhookHeaders): Promise<WebhookAnswer | null> {
  const app = shopifyApp();
  if (app === null) return null;
  return receiveShopifyWebhook({ ...intakeDeps(), secret: app.secret, log }, raw, headers);
}

/** Sends due tracking to every shop, or only to one connection's. */
export async function runTrackingSync(onlyConnection: string | null = null): Promise<TrackingResult | null> {
  const app = shopifyApp();
  if (app === null) return null;
  const key = channelKey();
  return syncTracking({ store: channelsStore(), admin: app.admin, shopOf: (connection) => shopOf(key, connection), log }, 50, onlyConnection);
}

const CURRENCY = "GBP" as const;

/** Everything the Channels screen shows for this member's brand. */
export async function loadChannelsPage(client: SupabaseClient, who: Readonly<{ brandId: string; userId: string; role: ClubRole }>): Promise<ChannelsPage> {
  const app = shopifyApp();
  const store = channelsStore();
  const [connections, listings, orders, products, orderProducts] = await Promise.all([
    store.connectionsOf(who.brandId, who.userId),
    store.listings(who.brandId),
    store.orders(who.brandId, 50),
    listProducts(client, who.brandId),
    loadOrderProducts(client, who.brandId, CURRENCY),
  ]);
  const connection = connections.find((one) => one.channel === "shopify");
  const shopify: ShopifyState =
    app === null && connection === undefined
      ? { state: "not_set_up" }
      : connection
        ? { state: "connected", testMode: app?.testMode ?? false, connection }
        : { state: "available", testMode: app?.testMode ?? false };
  const byId = new Map(orderProducts.map((one) => [one.productId, one]));
  const inputs = products.map((product) => ({
    productId: product.id,
    name: product.name,
    stage: product.stage,
    sizes: byId.get(product.id)?.sizes ?? [],
    ladder: byId.get(product.id)?.ladder ?? [],
  }));
  const shown = channelProducts(inputs, connection ? listings.filter((listing) => listing.connectionId === connection.id) : [], CURRENCY);
  return { canConnect: can(who.role, "manageMembers"), canList: can(who.role, "manageKit"), shopify, products: shown, orders: withNames(orders, shown) };
}
