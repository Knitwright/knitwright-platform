import { describe, expect, it } from "vitest";
import { brandHostRewrite, isSlug, shopPath, slugFrom, slugOfHost, storefrontUrl } from "./host";

describe("brand storefront addresses", () => {
  it("reads a brand's slug from its sub-domain, and nothing else", () => {
    expect(slugOfHost("lahore-lions.knitwright.com")).toBe("lahore-lions");
    expect(slugOfHost("Lahore-Lions.Knitwright.com:443")).toBe("lahore-lions");
    expect(slugOfHost("knitwright.com")).toBeNull();
    expect(slugOfHost("www.knitwright.com")).toBeNull();
    expect(slugOfHost("app.knitwright.com")).toBeNull();
    expect(slugOfHost("a.b.knitwright.com")).toBeNull();
    expect(slugOfHost("lions.example.com")).toBeNull();
    expect(slugOfHost(null)).toBeNull();
    expect(slugOfHost("shop.staging.test", "staging.test")).toBeNull();
    expect(slugOfHost("lions.staging.test", "staging.test")).toBe("lions");
  });

  it("rewrites a storefront host's pages under /shop, leaving the framework and the API alone", () => {
    expect(brandHostRewrite("lions.knitwright.com", "/")).toBe("/shop/lions");
    expect(brandHostRewrite("lions.knitwright.com", "/returns")).toBe("/shop/lions/returns");
    expect(brandHostRewrite("lions.knitwright.com", "/_next/static/x.js")).toBeNull();
    expect(brandHostRewrite("lions.knitwright.com", "/api/payments/webhook")).toBeNull();
    expect(brandHostRewrite("lions.knitwright.com", "/shop/lions")).toBeNull();
    expect(brandHostRewrite("app.knitwright.com", "/projects")).toBeNull();
    expect(brandHostRewrite("localhost:3000", "/")).toBeNull();
  });

  it("checks a slug: length, characters, dashes and the reserved names", () => {
    expect(isSlug("lions")).toBe(true);
    expect(isSlug("lahore-lions-fc")).toBe(true);
    expect(isSlug("ab")).toBe(false);
    expect(isSlug("-lions")).toBe(false);
    expect(isSlug("lions-")).toBe(false);
    expect(isSlug("li--ons")).toBe(false);
    expect(isSlug("Lions")).toBe(false);
    expect(isSlug("admin")).toBe(false);
    expect(isSlug("a".repeat(41))).toBe(false);
  });

  it("suggests a slug from a name", () => {
    expect(slugFrom("Lahore Lions FC")).toBe("lahore-lions-fc");
    expect(slugFrom("  Café Ünited!! ")).toBe("cafe-united");
    expect(slugFrom("AB")).toBe("ab-shop");
    expect(slugFrom("x".repeat(60)).length).toBe(40);
  });

  it("builds paths and the public address", () => {
    expect(shopPath("lions")).toBe("/shop/lions");
    expect(shopPath("lions", "/")).toBe("/shop/lions");
    expect(shopPath("lions", "returns")).toBe("/shop/lions/returns");
    expect(storefrontUrl("lions", "https://app.knitwright.com")).toBe("https://lions.knitwright.com");
    expect(storefrontUrl("lions", "http://localhost:3000")).toBe("http://localhost:3000/shop/lions");
  });
});
