import "server-only";
import { log } from "@/lib/server/log";
import { channelKey, channelsStore, shopifyApp } from "./server";
import { receiveFulfilmentNotice } from "./shopify/fulfilment-notice";
import { shopOf } from "./shopify/install";
import type { WebhookAnswer } from "./shopify/webhooks";

/** The fulfilment-service callback with this deploy's app (decision 0155). 503 without one. */
export async function acceptFulfilmentRequests(raw: string, hmac: string | null, shop: string | null): Promise<WebhookAnswer> {
  const app = shopifyApp();
  if (app === null) return { status: 503, message: "Shopify is not set up." };
  const key = channelKey();
  return receiveFulfilmentNotice({ secret: app.secret, store: channelsStore(), admin: app.admin, shopOf: (connection) => shopOf(key, connection), log }, raw, hmac, shop);
}
