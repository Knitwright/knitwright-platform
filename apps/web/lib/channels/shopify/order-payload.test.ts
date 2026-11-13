import { describe, expect, it } from "vitest";
import { numericId, orderFromGraphql, orderFromWebhook, shipToOf } from "./order-payload";

const WEBHOOK = {
  id: 5001,
  name: "#1042",
  currency: "GBP",
  email: "buyer@example.com",
  line_items: [{ id: 11, variant_id: 22, sku: "KW-x-M", quantity: 2, price: "35.00" }, { id: 12, variant_id: null, sku: null, quantity: 1 }],
  shipping_address: { first_name: "Sam", last_name: "Player", address1: "1 High St", city: "Leeds", zip: "LS1", country_code: "GB" },
};

describe("a Shopify order (decision 0155)", () => {
  it("keeps only what making and shipping need, from the webhook", () => {
    const order = orderFromWebhook(WEBHOOK)!;
    expect(order).toEqual({
      id: "5001",
      name: "#1042",
      currency: "GBP",
      lines: [{ id: "11", variantId: "22", sku: "KW-x-M", quantity: 2 }, { id: "12", variantId: null, sku: "", quantity: 1 }],
      shipTo: { name: "Sam Player", address1: "1 High St", address2: "", city: "Leeds", region: "", postcode: "LS1", country: "GB", phone: "" },
    });
    expect(JSON.stringify(order)).not.toContain("buyer@example.com");
  });

  it("is null when the body is not an order", () => {
    expect(orderFromWebhook({ id: "x" })).toBeNull();
    expect(orderFromWebhook(null)).toBeNull();
    expect(shipToOf(null)).toBeNull();
  });

  it("reads the Admin API's shape the same way", () => {
    const node = {
      id: "gid://shopify/Order/5001",
      name: "#1042",
      currencyCode: "AUD",
      lineItems: { nodes: [{ id: "gid://shopify/LineItem/11", quantity: 1, sku: "S", variant: { id: "gid://shopify/ProductVariant/22" } }, { id: "gid://shopify/LineItem/12", quantity: 1, sku: null, variant: null }] },
      shippingAddress: { name: "Sam", address1: "1", address2: null, city: "Perth", province: "WA", zip: "6000", countryCodeV2: "AU", phone: null },
    };
    const order = orderFromGraphql(node)!;
    expect(order.id).toBe("5001");
    expect(order.lines).toEqual([{ id: "11", variantId: "22", sku: "S", quantity: 1 }, { id: "12", variantId: null, sku: "", quantity: 1 }]);
    expect(order.shipTo?.region).toBe("WA");
    expect(orderFromGraphql({ ...node, shippingAddress: null })?.shipTo).toBeNull();
    expect(orderFromGraphql({})).toBeNull();
    expect(numericId("gid://shopify/Order/9")).toBe("9");
  });
});
