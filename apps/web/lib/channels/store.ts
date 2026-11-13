import type { ShipTo } from "./shopify/admin";
import type { Sealed } from "./token-crypto";

/**
 * The channel tables (migration 20261228050000), behind an interface so the rules can be tested without a database
 * (`fixtures/memory-store.ts`) and run against one through the server's key (`db.ts`). Every write is one of the
 * migration's functions; this file only names them and the rows they answer.
 */

export type ChannelId = "shopify" | "csv";

/** What a member may know of a connection. Never the token. */
export interface ConnectionView {
  readonly id: string;
  readonly channel: "shopify";
  readonly shop: string;
  readonly scopes: string;
  readonly hasLocation: boolean;
  readonly connectedBy: string | null;
  readonly connectedAt: string;
}

/** The server's own read of an active connection, with the sealed token. */
export interface ConnectionSecret {
  readonly id: string;
  readonly brandId: string;
  readonly shop: string;
  readonly sealed: Sealed;
  readonly locationId: string | null;
  readonly connectedBy: string | null;
}

export interface ListingRow {
  readonly id: string;
  readonly connectionId: string;
  readonly productId: string;
  /** The product's design, read beside the listing. */
  readonly projectId: string;
  readonly sizeLabel: string;
  readonly externalProductId: string;
  readonly externalVariantId: string;
  readonly sku: string;
  readonly priceMinor: number;
  readonly currency: "GBP" | "AUD";
  readonly releaseId: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly flags: readonly Readonly<{ code: string; text: string }>[];
  readonly pushedAt: string;
}

export type NewListing = Omit<ListingRow, "id" | "pushedAt" | "projectId">;

export interface ChannelOrderRow {
  readonly id: string;
  readonly channel: ChannelId;
  readonly externalOrderId: string;
  readonly externalLineId: string;
  readonly orderName: string;
  readonly productId: string;
  readonly sizeLabel: string;
  readonly pieces: number;
  readonly state: "received" | "submitted" | "refused";
  readonly message: string | null;
  readonly orderId: string | null;
  readonly receivedAt: string;
  readonly trackingSyncedAt: string | null;
}

export interface IncomingLine {
  readonly brandId: string;
  readonly channel: ChannelId;
  readonly connectionId: string | null;
  readonly externalOrderId: string;
  readonly externalLineId: string;
  readonly orderName: string;
  readonly productId: string;
  readonly sizeLabel: string;
  readonly pieces: number;
  readonly shipTo: ShipTo | null;
}

export type TrackingDue = Readonly<{ id: string; connectionId: string; externalOrderId: string; courier: string; trackingNumber: string }>;

export interface ChannelsStore {
  connect(input: Readonly<{ brandId: string; userId: string; shop: string; sealed: Sealed; scopes: string }>): Promise<string>;
  setLocation(connectionId: string, locationId: string): Promise<void>;
  disconnect(brandId: string, userId: string, connectionId: string): Promise<void>;
  uninstalled(shop: string): Promise<boolean>;
  connectionsOf(brandId: string, userId: string): Promise<readonly ConnectionView[]>;
  secretById(connectionId: string): Promise<ConnectionSecret | null>;
  secretByShop(shop: string): Promise<ConnectionSecret | null>;
  recordListing(brandId: string, userId: string, listing: NewListing): Promise<string>;
  listings(brandId: string): Promise<readonly ListingRow[]>;
  listingByVariant(connectionId: string, variantId: string): Promise<ListingRow | null>;
  receiveLine(line: IncomingLine): Promise<Readonly<{ id: string; state: ChannelOrderRow["state"]; created: boolean }>>;
  settleLine(id: string, state: "submitted" | "refused", message: string | null, refs: Readonly<{ paymentId: string | null; orderId: string | null; runId: string | null }>): Promise<void>;
  orders(brandId: string, limit: number): Promise<readonly ChannelOrderRow[]>;
  trackingDue(limit: number): Promise<readonly TrackingDue[]>;
  markTrackingSynced(id: string): Promise<void>;
  redactCustomer(shop: string, orderIds: readonly string[]): Promise<number>;
  redactShop(shop: string): Promise<number>;
}
