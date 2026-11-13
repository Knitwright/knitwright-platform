import { describe, expect, it } from "vitest";
import { verifyBody, verifyQuery } from "./hmac";
import { orderFromWebhook } from "./order-payload";
import { shopifyFrom } from "./select";
import { STAND_IN_API_KEY, standInAdmin, standInOrderEvent, standInOrderId, standInReturnQuery, standInSecret } from "./stand-in";

const SHOP = { shop: "club.myshopify.com", accessToken: "t" };

describe("the Shopify stand-in (decision 0155)", () => {
  it("signs its install return and its order events as Shopify does", () => {
    const secret = standInSecret("server");
    expect(verifyQuery(secret, standInReturnQuery(secret, "club.myshopify.com", "nonce", 1))).toBe(true);
    const event = standInOrderEvent(secret, { id: "5001", name: "#1", currency: "GBP", lines: [{ id: "1", variantId: "2", sku: "s", quantity: 1 }], shipTo: null });
    expect(verifyBody(secret, event.raw, event.hmac)).toBe(true);
    expect(orderFromWebhook(JSON.parse(event.raw))?.lines[0]?.variantId).toBe("2");
    const withAddress = standInOrderEvent(secret, { id: "5", name: "#2", currency: "GBP", lines: [{ id: "1", variantId: null, sku: "s", quantity: 1 }], shipTo: { name: "A", address1: "1", address2: "", city: "L", region: "", postcode: "P", country: "GB", phone: "" } });
    expect(orderFromWebhook(JSON.parse(withAddress.raw))?.shipTo?.postcode).toBe("P");
    expect(standInSecret("server")).not.toBe(standInSecret("other"));
  });

  it("answers like the Admin API without reaching the network, the same way each time", async () => {
    const admin = standInAdmin();
    expect((await admin.exchangeCode("club.myshopify.com", "c")).accessToken).toMatch(/^shpat_test_\d{20}$/);
    expect((await admin.registerFulfilmentService(SHOP, "u")).locationId).toMatch(/^gid:\/\/shopify\/Location\/\d+$/);
    await expect(admin.registerWebhooks(SHOP, "u")).resolves.toBeUndefined();
    const product = { existingProductId: null, title: "Home", description: "", variants: [{ size: "M", sku: "KW-a-M", priceMinor: 100 }], currency: "GBP" as const, locationId: null };
    const once = await admin.pushProduct(SHOP, product);
    expect(await admin.pushProduct(SHOP, product)).toEqual(once);
    expect((await admin.pushProduct(SHOP, { ...product, existingProductId: "9" })).productId).toBe("9");
    expect(await admin.paidOrdersSince(SHOP, new Date())).toEqual([]);
    expect(await admin.acceptFulfilmentRequests(SHOP)).toBe(0);
    await expect(admin.sendTracking(SHOP, { orderId: "1", courier: "c", trackingNumber: "t" })).resolves.toBeUndefined();
    expect(standInOrderId("a")).toMatch(/^[1-9]\d{12}$/);
  });
});

describe("which Shopify a deploy talks to", () => {
  const base = { SUPABASE_SECRET_KEY: "server" };
  it("is the Partner app with both keys, the stand-in in test mode, otherwise none", () => {
    const real = shopifyFrom({ ...base, SHOPIFY_APP_API_KEY: "key12345", SHOPIFY_APP_API_SECRET: "secret" });
    expect(real?.admin.name).toBe("shopify");
    expect(real?.authorizeUrl("club.myshopify.com", "a=1")).toBe("https://club.myshopify.com/admin/oauth/authorize?a=1");
    const stand = shopifyFrom({ ...base, SHOPIFY_APP_TEST_MODE: "on" });
    expect(stand).toMatchObject({ apiKey: STAND_IN_API_KEY, testMode: true, secret: standInSecret("server") });
    expect(stand?.authorizeUrl("club.myshopify.com", "a=1")).toBe("/store/channels/test-install?a=1&shop=club.myshopify.com");
    expect(shopifyFrom({ ...base, SHOPIFY_APP_API_KEY: "key12345", SHOPIFY_APP_TEST_MODE: "on" })).toBeNull();
    expect(shopifyFrom(base)).toBeNull();
  });
});
