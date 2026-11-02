import { describe, expect, it } from "vitest";
import { storeProduct } from "./product";
import { bareProduct, fullProduct, ids, todayProduct } from "./fixtures/samples";

/**
 * One published product. "Published" is a record: a product is here because a hand-off names it, and
 * `publishedBy` says which. Everything else is carried with its gaps showing.
 */

describe("a published product", () => {
  it("says why it is in the payload at all, and never carries an empty reason", () => {
    const product = storeProduct(fullProduct());

    expect(product.publishedBy).toEqual([
      { via: "collection-drop", collectionId: ids.collection, dropId: ids.drop, dropVersion: 1, at: "2027-01-02T10:00:00.000Z" },
    ]);
    expect(storeProduct(bareProduct()).publishedBy[0]?.via).toBe("flow-listing");
  });

  it("refuses to be built for a product no hand-off names, because that would be a guess", () => {
    expect(() => storeProduct(fullProduct({ publications: [] }))).toThrow(/a hand-off names it/);
  });

  it("names the article, its class and the design version it stands on", () => {
    const product = storeProduct(fullProduct());
    if (product.article.status !== "held") throw new Error("held");

    expect(product.article.code).toBe("JSY-SS-01");
    expect(product.article.productionClass).toBe("A");
    expect(product.designVersion).toBe(7);
  });

  it("is a gap for the article where no hand-off and no run names one", () => {
    const product = storeProduct(bareProduct());

    expect(product.article.status).toBe("gap");
    expect(product.sizes.status).toBe("gap");
    expect(product.sizeChart.status).toBe("gap");
    expect(product.prices.status).toBe("gap");
  });
});

describe("the sizes of a published product", () => {
  it("is the article's own run, with the plan's target beside each size", () => {
    const product = storeProduct(fullProduct());
    if (product.sizes.status !== "held") throw new Error("held");

    expect(product.sizes.run.map((size) => size.size)).toEqual(["S", "M", "L"]);
    expect(product.sizes.run.every((size) => size.inSizeRun)).toBe(true);
    const planned = product.sizes.run.find((size) => size.size === "M")?.planned;
    if (planned?.status !== "held") throw new Error("held");
    expect(planned.targetQty).toBe(20);
  });

  it("is a gap for a size no plan set a target for, so a target is never read as nothing", () => {
    const product = storeProduct(fullProduct());
    if (product.sizes.status !== "held") throw new Error("held");
    const planned = product.sizes.run.find((size) => size.size === "S")?.planned;
    if (planned?.status !== "gap") throw new Error("gap");

    expect(planned.because).toContain("A target is a plan, not an amount the Store may offer.");
  });

  it("marks a size a plan asked for that the article has no grade for", () => {
    const product = storeProduct(fullProduct({ planned: [{ size: "XXL", targetQty: 5 }] }));
    if (product.sizes.status !== "held") throw new Error("held");

    expect(product.sizes.run.find((size) => size.size === "XXL")?.inSizeRun).toBe(false);
  });
});

describe("the pictures of a published product", () => {
  it("is every item of the launch pack, in the order the hand-off set", () => {
    const product = storeProduct(fullProduct());
    if (product.media.status !== "held") throw new Error("held");

    expect(product.media.items.map((item) => item.sort)).toEqual([1, 2]);
    expect(product.media.items[1]?.label).toBe("AI-generated");
    expect(product.media.items[1]?.trueColourFileId).toBe("f1");
    expect(product.media.items.every((item) => item.listingId === ids.listing)).toBe(true);
  });

  it("is a gap where no launch pack has been handed over, and says no other product's picture may stand in", () => {
    const product = storeProduct(todayProduct());
    if (product.media.status !== "gap") throw new Error("gap");

    expect(product.media.because).toContain("must not use a picture of another product");
  });
});

describe("a product as the platform really holds it today", () => {
  it("cannot be sold, and says every reason", () => {
    const product = storeProduct(todayProduct());

    expect(product.sellability.sellable).toBe(false);
    expect(product.sellability.blockers.map((blocker) => blocker.code)).toEqual([
      "care_label_refused",
      "no_price_aud",
      "no_delivery_date",
      "no_size_chart",
      "no_media",
    ]);
  });

  it("agrees with its own fields: a blocker is never raised over a field the payload shows as held", () => {
    const product = storeProduct(fullProduct());
    const codes = product.sellability.blockers.map((blocker) => blocker.code);

    expect(product.delivery.promised.status).toBe("held");
    expect(codes).not.toContain("no_delivery_date");
    expect(product.sizeChart.status).toBe("held");
    expect(codes).not.toContain("no_size_chart");
  });
});
