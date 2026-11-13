import { createHash, createHmac } from "node:crypto";
import type { ShopifyAdmin, ShopifyOrder } from "./admin";
import { signBody, signQuery } from "./hmac";

/**
 * THE SHOPIFY STAND-IN (plan v6 C4, decision 0155): Shopify wherever SHOPIFY_APP_TEST_MODE is on and no Partner app
 * keys are set — the browser tests, CI and a local run. It never reaches the network.
 *
 * Its "install" page is a page of this app (`/store/channels/test-install`) that sends the browser back to the real
 * OAuth return with a query signed exactly as Shopify signs one; its "test order" is the body Shopify's
 * `orders/paid` webhook would send, signed the same way and handed to the same webhook handler. So every test walks
 * the real path: HMAC, state, token encryption, order intake, C1's invoice gate, D1's gate.
 *
 * The environment check refuses SHOPIFY_APP_TEST_MODE wherever real people sign in.
 */

export const STAND_IN_API_KEY = "kw-test-shopify-app";

/** The stand-in app's secret: derived from the server key, never configured, never the same as another deploy's. */
export const standInSecret = (serverKey: string): string => createHmac("sha256", serverKey).update("knitwright-test-shopify").digest("hex");

export const TEST_INSTALL_PATH = "/store/channels/test-install";

const digits = (seed: string, length = 13): string => {
  const bytes = createHash("sha256").update(seed).digest();
  const out = Array.from(bytes.subarray(0, length), (byte) => String(byte % 10)).join("");
  return `${(bytes[length % bytes.length]! % 9) + 1}${out.slice(1)}`;
};

export function standInAdmin(): ShopifyAdmin {
  return {
    name: "stand-in",
    async exchangeCode(shop, code) {
      return { accessToken: `shpat_test_${digits(`${shop}:${code}`, 20)}`, scope: "write_products,read_orders" };
    },
    async registerFulfilmentService(shop) {
      return { locationId: `gid://shopify/Location/${digits(`${shop.shop}:location`)}` };
    },
    async registerWebhooks() {},
    async pushProduct(shop, product) {
      const productId = product.existingProductId ?? digits(`${shop.shop}:${product.title}:${product.variants.map((one) => one.sku).join(",")}`);
      return { productId, variants: product.variants.map((variant) => ({ size: variant.size, sku: variant.sku, variantId: digits(`${productId}:${variant.size}`) })) };
    },
    async paidOrdersSince() {
      return [];
    },
    async acceptFulfilmentRequests() {
      return 0;
    },
    async sendTracking() {},
  };
}

/** The query Shopify sends the browser back with after an install: code, shop, state, timestamp and its hmac. */
export function standInReturnQuery(secret: string, shop: string, state: string, nowSeconds: number): Record<string, string> {
  const params = { code: digits(`${shop}:${state}`, 16), shop, state, timestamp: String(nowSeconds), host: Buffer.from(`${shop}/admin`).toString("base64url") };
  return { ...params, hmac: signQuery(secret, params) };
}

/** The `orders/paid` body Shopify would send for this order, and its signature header. */
export function standInOrderEvent(secret: string, order: ShopifyOrder): Readonly<{ raw: string; hmac: string }> {
  const raw = JSON.stringify({
    id: Number(order.id),
    name: order.name,
    currency: order.currency,
    financial_status: "paid",
    line_items: order.lines.map((line) => ({ id: Number(line.id), variant_id: line.variantId === null ? null : Number(line.variantId), sku: line.sku, quantity: line.quantity })),
    shipping_address: order.shipTo
      ? { name: order.shipTo.name, address1: order.shipTo.address1, address2: order.shipTo.address2, city: order.shipTo.city, province: order.shipTo.region, zip: order.shipTo.postcode, country_code: order.shipTo.country, phone: order.shipTo.phone }
      : null,
  });
  return { raw, hmac: signBody(secret, raw) };
}

/** A made-up order number for a test order, unique enough per press. */
export const standInOrderId = (seed: string): string => digits(seed);
