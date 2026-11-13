import { describe, expect, it } from "vitest";
import { graphqlAdmin, SHOPIFY_API_VERSION } from "./graphql";

type Call = { url: string; init: RequestInit };

/** A fake Shopify: answers each request in turn, and records it. */
function fakeShopify(answers: readonly unknown[], status = 200) {
  const calls: Call[] = [];
  let at = 0;
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answers[at++] ?? {}), { status });
  };
  return { calls, admin: graphqlAdmin({ apiKey: "key", apiSecret: "secret", fetch }) };
}

const SHOP = { shop: "club.myshopify.com", accessToken: "shpat_x" };
const body = (call: Call) => JSON.parse(String(call.init.body)) as { query: string; variables: Record<string, unknown> };

describe("the Admin API adapter (decision 0155)", () => {
  it("swaps the install code for an offline token", async () => {
    const { calls, admin } = fakeShopify([{ access_token: "shpat_new", scope: "write_products" }]);
    expect(await admin.exchangeCode("club.myshopify.com", "code")).toEqual({ accessToken: "shpat_new", scope: "write_products" });
    expect(calls[0]!.url).toBe("https://club.myshopify.com/admin/oauth/access_token");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ client_id: "key", client_secret: "secret", code: "code" });
  });

  it("refuses an install code Shopify refuses, without the secret in the message", async () => {
    const { admin } = fakeShopify([{ error: "bad" }], 400);
    await expect(admin.exchangeCode("club.myshopify.com", "code")).rejects.toThrow(/refused the install code/);
    await expect(admin.exchangeCode("club.myshopify.com", "code")).rejects.not.toThrow(/secret/);
  });

  it("calls the pinned API version with the token in Shopify's header only", async () => {
    const { calls, admin } = fakeShopify([{ data: { fulfillmentServiceCreate: { fulfillmentService: { location: { id: "gid://shopify/Location/1" } }, userErrors: [] } } }]);
    expect(await admin.registerFulfilmentService(SHOP, "https://kw.test/cb")).toEqual({ locationId: "gid://shopify/Location/1" });
    expect(calls[0]!.url).toBe(`https://club.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`);
    expect((calls[0]!.init.headers as Record<string, string>)["x-shopify-access-token"]).toBe("shpat_x");
    expect(body(calls[0]!).variables).toEqual({ name: "Knitwright", callbackUrl: "https://kw.test/cb" });
  });

  it("turns user errors and failed answers into an error that holds no token", async () => {
    const { admin } = fakeShopify([{ data: { fulfillmentServiceCreate: { fulfillmentService: null, userErrors: [{ message: "Name taken" }] } } }]);
    await expect(admin.registerFulfilmentService(SHOP, "u")).rejects.toThrow("Fulfilment service: Name taken");
    const failed = fakeShopify([{ errors: ["x"] }], 500);
    await expect(failed.admin.acceptFulfilmentRequests(SHOP)).rejects.toThrow(/answered 500 on club.myshopify.com/);
    await expect(failed.admin.acceptFulfilmentRequests(SHOP)).rejects.not.toThrow(/shpat/);
    const none = fakeShopify([{ data: { fulfillmentServiceCreate: { fulfillmentService: { location: null }, userErrors: [] } } }]);
    await expect(none.admin.registerFulfilmentService(SHOP, "u")).rejects.toThrow(/no location/);
  });

  it("registers both webhooks, and a second install's 'already taken' is not a failure", async () => {
    const { calls, admin } = fakeShopify([
      { data: { webhookSubscriptionCreate: { userErrors: [] } } },
      { data: { webhookSubscriptionCreate: { userErrors: [{ message: "Address for this topic has already been taken" }] } } },
    ]);
    await admin.registerWebhooks(SHOP, "https://kw.test/hook");
    expect(calls.map((call) => body(call).variables.topic)).toEqual(["ORDERS_PAID", "APP_UNINSTALLED"]);
    const bad = fakeShopify([{ data: { webhookSubscriptionCreate: { userErrors: [{ message: "Invalid address" }] } } }]);
    await expect(bad.admin.registerWebhooks(SHOP, "x")).rejects.toThrow("Webhook ORDERS_PAID: Invalid address");
  });

  it("pushes a product with a Size option, a variant per size and its SKU, stocked at our location", async () => {
    const { calls, admin } = fakeShopify([
      {
        data: {
          productSet: {
            product: { id: "gid://shopify/Product/7", variants: { nodes: [{ id: "gid://shopify/ProductVariant/71", selectedOptions: [{ name: "Size", value: "M" }], inventoryItem: { sku: "KW-a-M" } }, { id: "gid://shopify/ProductVariant/72", selectedOptions: [], inventoryItem: null }] } },
            userErrors: [],
          },
        },
      },
    ]);
    const pushed = await admin.pushProduct(SHOP, { existingProductId: "7", title: "Home", description: "d", variants: [{ size: "M", sku: "KW-a-M", priceMinor: 3500 }], currency: "GBP", locationId: "gid://shopify/Location/1" });
    expect(pushed).toEqual({ productId: "7", variants: [{ size: "M", variantId: "71", sku: "KW-a-M" }, { size: "", variantId: "72", sku: "" }] });
    const input = body(calls[0]!).variables.input as Record<string, unknown>;
    expect(input.id).toBe("gid://shopify/Product/7");
    expect(input.variants).toEqual([{ optionValues: [{ optionName: "Size", name: "M" }], price: "35.00", inventoryItem: { sku: "KW-a-M", tracked: false }, inventoryQuantities: [{ locationId: "gid://shopify/Location/1", name: "available", quantity: 0 }] }]);
    const fresh = fakeShopify([{ data: { productSet: { product: null, userErrors: [] } } }]);
    await expect(fresh.admin.pushProduct(SHOP, { existingProductId: null, title: "t", description: "d", variants: [], currency: "GBP", locationId: null })).rejects.toThrow(/no product/);
    expect((body(fresh.calls[0]!).variables.input as Record<string, unknown>).id).toBeUndefined();
  });

  it("reads paid orders since a time, dropping any it cannot read", async () => {
    const { calls, admin } = fakeShopify([{ data: { orders: { nodes: [{ id: "gid://shopify/Order/1", name: "#1", currencyCode: "GBP", lineItems: { nodes: [] }, shippingAddress: null }, { bad: true }] } } }]);
    const orders = await admin.paidOrdersSince(SHOP, new Date("2026-11-01T00:00:00Z"));
    expect(orders.map((order) => order.id)).toEqual(["1"]);
    expect(body(calls[0]!).variables.q).toBe("financial_status:paid updated_at:>'2026-11-01T00:00:00.000Z'");
  });

  it("accepts every waiting fulfilment request", async () => {
    const { calls, admin } = fakeShopify([
      { data: { shop: { assignedFulfillmentOrders: { nodes: [{ id: "f1" }, { id: "f2" }] } } } },
      { data: { fulfillmentOrderAcceptFulfillmentRequest: { userErrors: [] } } },
      { data: { fulfillmentOrderAcceptFulfillmentRequest: { userErrors: [] } } },
    ]);
    expect(await admin.acceptFulfilmentRequests(SHOP)).toBe(2);
    expect(calls).toHaveLength(3);
  });

  it("sends tracking against the order's open fulfilment orders, and does nothing when none is open", async () => {
    const { calls, admin } = fakeShopify([
      { data: { order: { fulfillmentOrders: { nodes: [{ id: "fo1", status: "OPEN" }, { id: "fo2", status: "CLOSED" }] } } } },
      { data: { fulfillmentCreate: { userErrors: [] } } },
    ]);
    await admin.sendTracking(SHOP, { orderId: "5001", courier: "DHL", trackingNumber: "JD1" });
    expect(body(calls[0]!).variables.id).toBe("gid://shopify/Order/5001");
    expect(body(calls[1]!).variables.f).toEqual({ lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: "fo1" }], trackingInfo: { company: "DHL", number: "JD1" }, notifyCustomer: true });
    const closed = fakeShopify([{ data: { order: null } }]);
    await closed.admin.sendTracking(SHOP, { orderId: "1", courier: "c", trackingNumber: "t" });
    expect(closed.calls).toHaveLength(1);
  });
});
