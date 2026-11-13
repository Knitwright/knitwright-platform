import { describe, expect, it } from "vitest";
import { brandHost, domainSuffix, isSlug, shopPath, slugFrom, slugOfHost, storefrontUrl } from "./host";

const ROOT = "knitwright.com";

describe("brand storefront addresses", () => {
  it("reads a brand's slug from its sub-domain, and nothing else", () => {
    expect(slugOfHost("lahore-lions.knitwright.com", ROOT)).toBe("lahore-lions");
    expect(slugOfHost("Lahore-Lions.Knitwright.com:443", ROOT)).toBe("lahore-lions");
    expect(slugOfHost("knitwright.com", ROOT)).toBeNull();
    expect(slugOfHost("www.knitwright.com", ROOT)).toBeNull();
    expect(slugOfHost("app.knitwright.com", ROOT)).toBeNull();
    expect(slugOfHost("a.b.knitwright.com", ROOT)).toBeNull();
    expect(slugOfHost("lions.example.com", ROOT)).toBeNull();
    expect(slugOfHost(null, ROOT)).toBeNull();
    expect(slugOfHost("lions.localhost:3000", "localhost")).toBe("lions");
  });

  it("rewrites a name's pages under /shop, leaving the framework, the API and the clubs' own paths alone", () => {
    expect(brandHost("lions.knitwright.com", "/", ROOT)).toBe("/shop/lions");
    expect(brandHost("lions.knitwright.com", "/returns", ROOT)).toBe("/shop/lions/returns");
    for (const path of ["/_next/static/x.js", "/api/payments/webhook", "/shop/lions", "/shop", "/clubs/lions", "/t/Ab3dEf7hJk"]) {
      expect(brandHost("lions.knitwright.com", path, ROOT)).toBeNull();
    }
    expect(brandHost("app.knitwright.com", "/projects", ROOT)).toBeNull();
    expect(brandHost("localhost:3000", "/", ROOT)).toBeNull();
  });

  it("checks a slug: length, characters, dashes and the names kept for Knitwright", () => {
    expect(isSlug("lions")).toBe(true);
    expect(isSlug("lahore-lions-fc")).toBe(true);
    for (const bad of ["ab", "-lions", "lions-", "li--ons", "Lions", "admin", "shop", "a".repeat(41)]) expect(isSlug(bad)).toBe(false);
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
    expect(storefrontUrl("lions", "https://app.knitwright.com", ROOT)).toBe("https://lions.knitwright.com");
    expect(storefrontUrl("lions", "http://localhost:3000/", undefined)).toBe("http://localhost:3000/shop/lions");
    expect(storefrontUrl("lions", "http://localhost:3000", "localhost")).toBe("http://localhost:3000/shop/lions");
    expect(domainSuffix(ROOT)).toBe(".knitwright.com");
    expect(domainSuffix(undefined)).toContain("/shop/");
  });
});
