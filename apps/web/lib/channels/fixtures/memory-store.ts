import type { ChannelOrderRow, ChannelsStore, ConnectionSecret, IncomingLine, ListingRow, TrackingDue } from "../store";

/**
 * The channel tables in memory, for the rules' tests (decision 0155). It keeps the database's own refusals that
 * the rules depend on: one active shop per brand and per shop, a line received once, a settled line left alone.
 */

type Conn = ConnectionSecret & { status: "active" | "uninstalled"; scopes: string; connectedAt: string };
type Order = ChannelOrderRow & { brandId: string; connectionId: string | null; shipTo: IncomingLine["shipTo"] };

export class StoreRefusal extends Error {}

export function memoryChannels(seed: Readonly<{ projectOf?: (productId: string) => string; shipments?: Map<string, { courier: string; trackingNumber: string }> }> = {}) {
  const connections: Conn[] = [];
  const listings: (ListingRow & { brandId: string })[] = [];
  const orders: Order[] = [];
  let next = 0;
  const id = () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const active = (one: Conn) => one.status === "active";
  const secret = (one: Conn | undefined): ConnectionSecret | null =>
    one && active(one) ? { id: one.id, brandId: one.brandId, shop: one.shop, sealed: one.sealed, locationId: one.locationId, connectedBy: one.connectedBy } : null;
  const end = (one: Conn) => Object.assign(one, { status: "uninstalled" as const, sealed: { ciphertext: "", nonce: "" } });

  const store: ChannelsStore = {
    async connect(input) {
      const same = connections.find((one) => active(one) && one.shop === input.shop);
      if (same && same.brandId !== input.brandId) throw new StoreRefusal("taken");
      if (same) {
        Object.assign(same, { sealed: input.sealed, scopes: input.scopes, connectedBy: input.userId });
        return same.id;
      }
      if (connections.some((one) => active(one) && one.brandId === input.brandId)) throw new StoreRefusal("connected");
      const row: Conn = { id: id(), brandId: input.brandId, shop: input.shop, sealed: input.sealed, locationId: null, connectedBy: input.userId, status: "active", scopes: input.scopes, connectedAt: "2026-11-13T09:00:00Z" };
      connections.push(row);
      return row.id;
    },
    async setLocation(connectionId, locationId) {
      const row = connections.find((one) => one.id === connectionId && active(one));
      if (row) row.locationId = locationId;
    },
    async disconnect(brandId, _userId, connectionId) {
      const row = connections.find((one) => one.id === connectionId && one.brandId === brandId && active(one));
      if (!row) throw new StoreRefusal("missing");
      end(row);
    },
    async uninstalled(shop) {
      const row = connections.find((one) => one.shop === shop && active(one));
      if (row) end(row);
      return row !== undefined;
    },
    async connectionsOf(brandId) {
      return connections.filter((one) => one.brandId === brandId && active(one)).map((one) => ({ id: one.id, channel: "shopify" as const, shop: one.shop, scopes: one.scopes, hasLocation: one.locationId !== null, connectedBy: one.connectedBy, connectedAt: one.connectedAt }));
    },
    secretById: async (connectionId) => secret(connections.find((one) => one.id === connectionId)),
    secretByShop: async (shop) => secret(connections.find((one) => one.shop === shop && active(one))),
    async recordListing(brandId, _userId, listing) {
      const existing = listings.find((one) => one.connectionId === listing.connectionId && one.productId === listing.productId && one.sizeLabel === listing.sizeLabel);
      if (existing) {
        Object.assign(existing, listing);
        return existing.id;
      }
      const row = { ...listing, id: id(), brandId, projectId: seed.projectOf?.(listing.productId) ?? "project", pushedAt: "2026-11-13T09:05:00Z" };
      listings.push(row);
      return row.id;
    },
    listings: async (brandId) => listings.filter((one) => one.brandId === brandId),
    listingByVariant: async (connectionId, variantId) => listings.find((one) => one.connectionId === connectionId && one.externalVariantId === variantId) ?? null,
    async receiveLine(line) {
      const found = orders.find((one) => one.brandId === line.brandId && one.channel === line.channel && one.externalOrderId === line.externalOrderId && one.externalLineId === line.externalLineId);
      if (found) return { id: found.id, state: found.state, created: false };
      const row: Order = { ...line, id: id(), state: "received", message: null, orderId: null, receivedAt: "2026-11-13T10:00:00Z", trackingSyncedAt: null };
      orders.push(row);
      return { id: row.id, state: "received", created: true };
    },
    async settleLine(lineId, state, message, refs) {
      const row = orders.find((one) => one.id === lineId && one.state === "received");
      if (row) Object.assign(row, { state, message, orderId: refs.orderId });
    },
    orders: async (brandId, limit) => orders.filter((one) => one.brandId === brandId).slice(0, limit),
    async trackingDue(limit) {
      const due: TrackingDue[] = [];
      for (const one of orders) {
        const parcel = one.orderId ? seed.shipments?.get(one.orderId) : undefined;
        const connected = connections.some((conn) => conn.id === one.connectionId && active(conn));
        if (one.channel === "shopify" && one.state === "submitted" && one.trackingSyncedAt === null && parcel && connected) {
          due.push({ id: one.id, connectionId: one.connectionId!, externalOrderId: one.externalOrderId, ...parcel });
        }
      }
      return due.slice(0, limit);
    },
    async markTrackingSynced(lineId) {
      const row = orders.find((one) => one.id === lineId);
      if (row) row.trackingSyncedAt = "2026-11-14T10:00:00Z";
    },
    async redactCustomer(shop, orderIds) {
      const ids = new Set(connections.filter((one) => one.shop === shop).map((one) => one.id));
      const hit = orders.filter((one) => one.connectionId !== null && ids.has(one.connectionId) && orderIds.includes(one.externalOrderId) && one.shipTo !== null);
      hit.forEach((one) => (one.shipTo = null));
      return hit.length;
    },
    async redactShop(shop) {
      const ids = new Set(connections.filter((one) => one.shop === shop).map((one) => one.id));
      const hit = orders.filter((one) => one.connectionId !== null && ids.has(one.connectionId) && one.shipTo !== null);
      hit.forEach((one) => (one.shipTo = null));
      connections.filter((one) => one.shop === shop && active(one)).forEach(end);
      return hit.length;
    },
  };
  return { store, connections, listings, orders };
}
