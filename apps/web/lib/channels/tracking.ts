import type { LogEvent } from "@/lib/server/core/guard";
import type { Shop, ShopifyAdmin } from "./shopify/admin";
import type { ChannelsStore, ConnectionSecret } from "./store";

/**
 * TRACKING BACK TO THE SHOP (plan v6 C4, decision 0155; spec F-L6 "sync tracking"). When ops records the first
 * parcel of an order that came from Shopify (`ops_shipments`), its courier and tracking number are sent to the
 * shop, which fulfils the line and tells the buyer. Run by the scheduler and by "Sync tracking" on the Channels
 * screen. A line is marked synced only after Shopify accepted it; a failure is logged and tried on the next run.
 */

export type TrackingDeps = Readonly<{
  store: ChannelsStore;
  admin: ShopifyAdmin;
  /** The connection's shop and its decrypted token, or null when it cannot be opened. */
  shopOf: (connection: ConnectionSecret) => Shop | null;
  log: (event: LogEvent) => void;
}>;

export type TrackingResult = Readonly<{ synced: number; failed: number }>;

export async function syncTracking(deps: TrackingDeps, limit = 50, onlyConnection: string | null = null): Promise<TrackingResult> {
  const due = (await deps.store.trackingDue(limit)).filter((line) => onlyConnection === null || line.connectionId === onlyConnection);
  const shops = new Map<string, Shop | null>();
  let synced = 0;
  let failed = 0;
  for (const line of due) {
    if (!shops.has(line.connectionId)) {
      const secret = await deps.store.secretById(line.connectionId);
      shops.set(line.connectionId, secret === null ? null : deps.shopOf(secret));
    }
    const shop = shops.get(line.connectionId) ?? null;
    if (shop === null) {
      failed += 1;
      continue;
    }
    try {
      await deps.admin.sendTracking(shop, { orderId: line.externalOrderId, courier: line.courier, trackingNumber: line.trackingNumber });
      await deps.store.markTrackingSynced(line.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      deps.log({ level: "error", message: "Tracking could not be sent to Shopify", where: `channel order ${line.id}`, error });
    }
  }
  return { synced, failed };
}
