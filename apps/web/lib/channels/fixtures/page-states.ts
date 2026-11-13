import type { ChannelsPage } from "../view";

/**
 * Made-up Channels screens for /dev/channels and the screen's tests (decision 0155): every state of 10 §9 the
 * screen has. No premium state: no plan gates sales channels (spec 02 F-L6 names none).
 */

const CONNECTION = { id: "00000000-0000-4000-8000-0000000000c4", channel: "shopify" as const, shop: "riverside-fc.myshopify.com", scopes: "write_products,read_orders", hasLocation: true, connectedBy: "u", connectedAt: "2026-11-13T09:00:00Z" };

const PRODUCTS: ChannelsPage["products"] = [
  { productId: "00000000-0000-4000-8000-0000000000a1", name: "Home shirt 26/27", sizes: ["S", "M", "L", "XL"], unitCostMinor: 1450, costNote: "Tier 1", listing: { priceMinor: 3500, currency: "GBP", pushedAt: "2026-11-13T09:05:00Z", sizes: 4 }, blocked: null },
  { productId: "00000000-0000-4000-8000-0000000000a2", name: "Training top", sizes: ["S", "M", "L"], unitCostMinor: null, costNote: "No price ladder for this article. Knitwright invoices the making.", listing: null, blocked: null },
  { productId: "00000000-0000-4000-8000-0000000000a3", name: "Away shirt draft", sizes: ["M"], unitCostMinor: null, costNote: "", listing: null, blocked: "Not ready to sell: approve its golden sample first, so it can be made in runs." },
];

const ORDERS: ChannelsPage["orders"] = [
  { id: "o1", channel: "shopify", externalOrderId: "5001", externalLineId: "1", orderName: "#1042", productId: PRODUCTS[0]!.productId, productName: "Home shirt 26/27", sizeLabel: "M", pieces: 2, state: "submitted", message: null, orderId: "x", receivedAt: "2026-11-13T10:12:00Z", trackingSyncedAt: null },
  { id: "o2", channel: "shopify", externalOrderId: "5002", externalLineId: "1", orderName: "#1043", productId: PRODUCTS[0]!.productId, productName: "Home shirt 26/27", sizeLabel: "XL", pieces: 1, state: "refused", message: "That design has a check that fails: the artwork is below 150 DPI.", orderId: null, receivedAt: "2026-11-13T10:20:00Z", trackingSyncedAt: null },
  { id: "o3", channel: "csv", externalOrderId: "club-7", externalLineId: "1", orderName: "CSV club-7", productId: PRODUCTS[0]!.productId, productName: "Home shirt 26/27", sizeLabel: "S", pieces: 12, state: "submitted", message: null, orderId: "y", receivedAt: "2026-11-12T16:00:00Z", trackingSyncedAt: null },
];

export const PAGE_STATES: Readonly<Record<string, ChannelsPage>> = {
  available: { canConnect: true, canList: true, shopify: { state: "available", testMode: false }, products: PRODUCTS, orders: [] },
  connected: { canConnect: true, canList: true, shopify: { state: "connected", testMode: false, connection: CONNECTION }, products: PRODUCTS, orders: ORDERS },
  "not-set-up": { canConnect: true, canList: true, shopify: { state: "not_set_up" }, products: [], orders: [] },
  viewer: { canConnect: false, canList: false, shopify: { state: "connected", testMode: false, connection: { ...CONNECTION, hasLocation: false } }, products: PRODUCTS, orders: ORDERS },
  empty: { canConnect: true, canList: true, shopify: { state: "connected", testMode: true, connection: CONNECTION }, products: [], orders: [] },
};
