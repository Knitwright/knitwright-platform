import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { queryMessage, shopDomain, signBody, signQuery, verifyBody, verifyQuery } from "./hmac";

const SECRET = "hush";

describe("Shopify's query HMAC (decision 0155)", () => {
  it("signs every parameter but hmac and signature, sorted, as Shopify documents", () => {
    const params = { shop: "a.myshopify.com", code: "c", timestamp: "1", hmac: "x", signature: "y" };
    expect(queryMessage(params)).toBe("code=c&shop=a.myshopify.com&timestamp=1");
    expect(signQuery(SECRET, params)).toBe(createHmac("sha256", SECRET).update("code=c&shop=a.myshopify.com&timestamp=1").digest("hex"));
  });

  it("accepts its own signature, in either case, and refuses anything else", () => {
    const params = { shop: "a.myshopify.com", code: "c", state: "s" };
    const hmac = signQuery(SECRET, params);
    expect(verifyQuery(SECRET, { ...params, hmac })).toBe(true);
    expect(verifyQuery(SECRET, { ...params, hmac: hmac.toUpperCase() })).toBe(true);
    expect(verifyQuery(SECRET, { ...params, code: "other", hmac })).toBe(false);
    expect(verifyQuery("other", { ...params, hmac })).toBe(false);
    expect(verifyQuery(SECRET, params)).toBe(false);
    expect(verifyQuery(SECRET, { ...params, hmac: "zz" })).toBe(false);
  });
});

describe("Shopify's webhook HMAC", () => {
  it("is base64 HMAC-SHA256 of the raw body", () => {
    const raw = '{"id":1}';
    const header = signBody(SECRET, raw);
    expect(header).toBe(createHmac("sha256", SECRET).update(raw).digest("base64"));
    expect(verifyBody(SECRET, raw, header)).toBe(true);
    expect(verifyBody(SECRET, raw, ` ${header} `)).toBe(true);
    expect(verifyBody(SECRET, '{"id":2}', header)).toBe(false);
    expect(verifyBody(SECRET, raw, null)).toBe(false);
    expect(verifyBody(SECRET, raw, "not base64")).toBe(false);
  });
});

describe("a shop's domain", () => {
  it("is name.myshopify.com, from what a person types", () => {
    expect(shopDomain("My-Club")).toBe("my-club.myshopify.com");
    expect(shopDomain("https://my-club.myshopify.com/admin")).toBe("my-club.myshopify.com");
    expect(shopDomain("my-club.myshopify.com")).toBe("my-club.myshopify.com");
    expect(shopDomain("evil.com")).toBeNull();
    expect(shopDomain("a.myshopify.com.evil.com")).toBeNull();
    expect(shopDomain("")).toBeNull();
  });
});
