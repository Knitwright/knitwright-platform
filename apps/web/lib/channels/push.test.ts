import { describe, expect, it, vi } from "vitest";
import { memoryChannels } from "./fixtures/memory-store";
import { pushProduct } from "./push";
import { standInAdmin } from "./shopify/stand-in";
import { NO_SIZES, NOT_OPEN, readSku, skuOf } from "./sku";
import { sealToken, tokenKey } from "./token-crypto";

const KEY = tokenKey(undefined, "server");
const SHOP = "club.myshopify.com";
const PRODUCT_ID = "0f6c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
const WHO = { brandId: "b1", userId: "u1" };
const TERMS = { releaseId: "r1", factoryProfileId: "knitwright-default", fabricKey: "mesh", flags: [] };

async function setUp() {
  const memory = memoryChannels({ projectOf: () => "pr1" });
  const admin = standInAdmin();
  const id = await memory.store.connect({ ...WHO, shop: SHOP, sealed: sealToken(KEY, "shpat_x", SHOP), scopes: "" });
  const deps = { store: memory.store, admin, key: KEY, siteUrl: "https://kw.test", log: vi.fn() };
  return { ...memory, admin, deps, connection: (await memory.store.secretById(id))! };
}

describe("SKUs (decision 0155)", () => {
  it("name the product and size, and read back", () => {
    expect(skuOf(PRODUCT_ID, "M")).toBe("KW-0f6c1a2b3c4d4e5f8a9b0c1d2e3f4a5b-M");
    expect(skuOf(PRODUCT_ID, "Age 7/8")).toBe("KW-0f6c1a2b3c4d4e5f8a9b0c1d2e3f4a5b-Age_7_8");
    expect(readSku(skuOf(PRODUCT_ID, "XL"))).toEqual({ productId: PRODUCT_ID, size: "XL" });
    expect(readSku("SHOP-OWN-1")).toBeNull();
  });
});

describe("pushing a product to Shopify", () => {
  it("sends one variant per size at the retail price, and records each to read orders back", async () => {
    const { deps, connection, listings, admin } = await setUp();
    const push = vi.spyOn(admin, "pushProduct");
    expect(await pushProduct(deps, WHO, connection, { productId: PRODUCT_ID, name: "Home shirt", sizes: ["M", "L"], terms: TERMS }, { priceMinor: 3500, currency: "GBP" }, [])).toBe(2);
    expect(push.mock.calls[0]![1]).toMatchObject({ existingProductId: null, title: "Home shirt", variants: [{ size: "M", sku: skuOf(PRODUCT_ID, "M"), priceMinor: 3500 }, { size: "L", sku: skuOf(PRODUCT_ID, "L"), priceMinor: 3500 }] });
    expect(push.mock.calls[0]![1].locationId).toMatch(/Location/);
    expect(listings.map((one) => [one.sizeLabel, one.releaseId, one.fabricKey, one.priceMinor])).toEqual([["M", "r1", "mesh", 3500], ["L", "r1", "mesh", 3500]]);
  });

  it("updates the same Shopify product on a second push", async () => {
    const { deps, connection, listings, admin, store } = await setUp();
    const product = { productId: PRODUCT_ID, name: "Home shirt", sizes: ["M"], terms: TERMS };
    await pushProduct(deps, WHO, connection, product, { priceMinor: 3500, currency: "GBP" }, []);
    const push = vi.spyOn(admin, "pushProduct");
    await pushProduct(deps, WHO, connection, product, { priceMinor: 4000, currency: "GBP" }, await store.listings("b1"));
    expect(push.mock.calls[0]![1].existingProductId).toBe(listings[0]!.externalProductId);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.priceMinor).toBe(4000);
  });

  it("refuses a product with no sizes, or a token it cannot open", async () => {
    const { deps, connection } = await setUp();
    await expect(pushProduct(deps, WHO, connection, { productId: PRODUCT_ID, name: "x", sizes: [], terms: TERMS }, { priceMinor: 100, currency: "GBP" }, [])).rejects.toThrow(NO_SIZES);
    await expect(pushProduct({ ...deps, key: tokenKey("22".repeat(32), "x") }, WHO, connection, { productId: PRODUCT_ID, name: "x", sizes: ["M"], terms: TERMS }, { priceMinor: 100, currency: "GBP" }, [])).rejects.toThrow(NOT_OPEN);
  });

  it("records only the sizes Shopify made", async () => {
    const { deps, connection, admin, listings } = await setUp();
    vi.spyOn(admin, "pushProduct").mockResolvedValue({ productId: "7", variants: [{ size: "M", variantId: "71", sku: "s" }] });
    expect(await pushProduct(deps, WHO, connection, { productId: PRODUCT_ID, name: "x", sizes: ["M", "L"], terms: TERMS }, { priceMinor: 100, currency: "GBP" }, [])).toBe(1);
    expect(listings).toHaveLength(1);
  });
});
