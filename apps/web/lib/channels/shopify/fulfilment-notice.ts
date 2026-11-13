import type { LogEvent } from "@/lib/server/core/guard";
import type { ChannelsStore, ConnectionSecret } from "../store";
import type { Shop, ShopifyAdmin } from "./admin";
import { shopDomain, verifyBody } from "./hmac";
import type { WebhookAnswer } from "./webhooks";

/**
 * The fulfilment service's callback (plan v6 C4, decision 0155). Shopify asks Knitwright to fulfil an order assigned
 * to our location; once the body's HMAC is Shopify's, every waiting request of that shop is accepted, so the shop
 * shows the order as in progress with Knitwright. Nothing in the body is trusted beyond the shop it names.
 */

export type NoticeDeps = Readonly<{
  secret: string;
  store: ChannelsStore;
  admin: ShopifyAdmin;
  shopOf: (connection: ConnectionSecret) => Shop | null;
  log: (event: LogEvent) => void;
}>;

export async function receiveFulfilmentNotice(deps: NoticeDeps, raw: string, hmac: string | null, shopHeader: string | null): Promise<WebhookAnswer> {
  if (!verifyBody(deps.secret, raw, hmac)) return { status: 401, message: "The signature does not match." };
  const shop = shopDomain(shopHeader ?? "");
  if (shop === null || shop !== shopHeader) return { status: 400, message: "No shop." };
  const connection = await deps.store.secretByShop(shop);
  const open = connection === null ? null : deps.shopOf(connection);
  if (open === null) return { status: 200, message: "No connection." };
  try {
    const accepted = await deps.admin.acceptFulfilmentRequests(open);
    return { status: 200, message: `Accepted ${accepted}.` };
  } catch (error) {
    deps.log({ level: "error", message: "Fulfilment requests could not be accepted", where: `shopify ${shop}`, error });
    return { status: 500, message: "Try again." };
  }
}
