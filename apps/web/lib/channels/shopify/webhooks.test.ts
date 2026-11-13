import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeC1 } from "../fixtures/c1";
import { memoryChannels } from "../fixtures/memory-store";
import { signBody } from "./hmac";
import { receiveShopifyWebhook } from "./webhooks";

const SECRET = "app-secret";
const SHOP = "club.myshopify.com";

async function connected(options: Parameters<typeof fakeC1>[1] = {}) {
  const memory = memoryChannels({ projectOf: () => "pr1" });
  const id = await memory.store.connect({ brandId: "b1", userId: "u1", shop: SHOP, sealed: { ciphertext: "c", nonce: "n" }, scopes: "" });
  await memory.store.recordListing("b1", "u1", { connectionId: id, productId: "p1", sizeLabel: "M", externalProductId: "7", externalVariantId: "71", sku: "KW-p1-M", priceMinor: 3500, currency: "GBP", releaseId: "r1", factoryProfileId: "f", fabricKey: "mesh", flags: [] });
  const log = vi.fn();
  const deps = { ...fakeC1(memory.store, options).deps, secret: SECRET, log };
  return { ...memory, deps, log, id };
}

const ORDER = { id: 5001, name: "#1042", currency: "GBP", line_items: [{ id: 11, variant_id: 71, sku: "KW-p1-M", quantity: 2 }, { id: 12, variant_id: 99, sku: "OWN", quantity: 1 }], shipping_address: { name: "Sam", address1: "1 High St", city: "Leeds", zip: "LS1", country_code: "GB" } };

const send = (deps: Parameters<typeof receiveShopifyWebhook>[0], topic: string, body: unknown, shop = SHOP, secret = SECRET) => {
  const raw = JSON.stringify(body);
  return receiveShopifyWebhook(deps, raw, { hmac: signBody(secret, raw), topic, shop });
};

describe("Shopify's webhooks (decision 0155)", () => {
  it("take a paid order's Knitwright lines in, and leave the shop's own stock alone", async () => {
    const { deps, orders } = await connected();
    expect(await send(deps, "orders/paid", ORDER)).toEqual({ status: 200, message: "Received 1, sent 1, refused 0." });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ externalOrderId: "5001", externalLineId: "11", productId: "p1", sizeLabel: "M", pieces: 2, state: "submitted", shipTo: { postcode: "LS1" } });
    expect(await send(deps, "orders/paid", ORDER)).toEqual({ status: 200, message: "Received 0, sent 0, refused 0." });
  });

  it("refuse a bad signature, a bad shop or a bad body before reading anything", async () => {
    const { deps, orders } = await connected();
    expect((await send(deps, "orders/paid", ORDER, SHOP, "forged")).status).toBe(401);
    expect((await send(deps, "orders/paid", ORDER, "evil.com")).status).toBe(400);
    const raw = "not json";
    expect((await receiveShopifyWebhook(deps, raw, { hmac: signBody(SECRET, raw), topic: "orders/paid", shop: SHOP })).status).toBe(400);
    expect((await send(deps, "orders/paid", { id: "nope" })).status).toBe(400);
    expect(orders).toHaveLength(0);
  });

  it("acknowledge an order from a shop that is not connected, and other topics, without acting", async () => {
    const { deps } = await connected();
    expect(await send(deps, "orders/paid", ORDER, "other.myshopify.com")).toEqual({ status: 200, message: "No connection." });
    expect(await send(deps, "products/update", {})).toEqual({ status: 200, message: "Ignored." });
  });

  it("answer 500 when taking an order failed, so Shopify sends it again", async () => {
    const { deps, log } = await connected({ openRefusal: new AppError("internal", "db down") });
    expect(await send(deps, "orders/paid", ORDER)).toEqual({ status: 500, message: "Try again." });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("end the connection and drop its token on app/uninstalled", async () => {
    const { deps, connections } = await connected();
    expect(await send(deps, "app/uninstalled", { id: 1 })).toEqual({ status: 200, message: "Disconnected." });
    expect(connections[0]).toMatchObject({ status: "uninstalled", sealed: { ciphertext: "" } });
    expect(await send(deps, "app/uninstalled", { id: 1 })).toEqual({ status: 200, message: "No connection." });
  });

  it("clear the buyer's address on the privacy webhooks, and log a data request for ops", async () => {
    const { deps, orders, log } = await connected();
    await send(deps, "orders/paid", ORDER);
    expect(await send(deps, "customers/redact", { customer: { id: 1 }, orders_to_redact: [9999] })).toEqual({ status: 200, message: "Redacted 0." });
    expect(await send(deps, "customers/redact", { orders_to_redact: [5001] })).toEqual({ status: 200, message: "Redacted 1." });
    expect(orders[0]!.shipTo).toBeNull();
    expect(await send(deps, "customers/redact", { orders_to_redact: "bad" })).toEqual({ status: 200, message: "Redacted 0." });
    expect(await send(deps, "shop/redact", { shop_domain: SHOP })).toEqual({ status: 200, message: "Redacted 0." });
    expect(await send(deps, "customers/data_request", { customer: { id: 1 } })).toEqual({ status: 200, message: "Recorded." });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: "warn", where: `shopify ${SHOP}` }));
  });
});
