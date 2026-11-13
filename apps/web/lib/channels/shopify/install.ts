import type { LogEvent } from "@/lib/server/core/guard";
import type { ChannelsStore, ConnectionSecret } from "../store";
import { openToken, sealToken } from "../token-crypto";
import type { Shop, ShopifyAdmin } from "./admin";

/**
 * Finishing an install (plan v6 C4, decision 0155), once `oauth.checkReturn` has accepted Shopify's return:
 *
 * 1. the code is swapped for an offline token, which is sealed (AES-256-GCM) before it is stored;
 * 2. Knitwright is registered as the shop's fulfilment service, and its location kept, so orders for our products
 *    are assigned to us;
 * 3. the shop's `orders/paid` and `app/uninstalled` webhooks are pointed at us.
 *
 * Steps 2 and 3 are retried on the next push if they fail; the connection itself stands once step 1 has.
 */

export type InstallDeps = Readonly<{
  store: ChannelsStore;
  admin: ShopifyAdmin;
  key: Buffer;
  siteUrl: string;
  log: (event: LogEvent) => void;
}>;

export const WEBHOOK_PATH = "/api/channels/shopify/webhooks";
export const FULFILMENT_PATH = "/api/channels/shopify/fulfilment";

/** The shop and its token, from a stored connection. Null when the ciphertext does not open with this key. */
export const shopOf = (key: Buffer, connection: ConnectionSecret): Shop | null => {
  const accessToken = openToken(key, connection.sealed, connection.shop);
  return accessToken === null ? null : { shop: connection.shop, accessToken };
};

/** Registers the fulfilment service and webhooks where that has not happened yet. Never throws. */
export async function ensureRegistered(deps: InstallDeps, connection: ConnectionSecret): Promise<boolean> {
  if (connection.locationId !== null) return true;
  const shop = shopOf(deps.key, connection);
  if (shop === null) return false;
  try {
    const { locationId } = await deps.admin.registerFulfilmentService(shop, new URL(FULFILMENT_PATH, deps.siteUrl).toString());
    await deps.store.setLocation(connection.id, locationId);
    await deps.admin.registerWebhooks(shop, new URL(WEBHOOK_PATH, deps.siteUrl).toString());
    return true;
  } catch (error) {
    deps.log({ level: "error", message: "Shopify registration did not finish; it is tried again on the next push", where: `shopify ${connection.shop}`, error });
    return false;
  }
}

export async function finishInstall(deps: InstallDeps, input: Readonly<{ brandId: string; userId: string; shop: string; code: string }>): Promise<string> {
  const granted = await deps.admin.exchangeCode(input.shop, input.code);
  const id = await deps.store.connect({ brandId: input.brandId, userId: input.userId, shop: input.shop, sealed: sealToken(deps.key, granted.accessToken, input.shop), scopes: granted.scope });
  const connection = await deps.store.secretById(id);
  if (connection) await ensureRegistered(deps, connection);
  return id;
}
