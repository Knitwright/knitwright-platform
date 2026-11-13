import { describe, expect, it } from "vitest";
import { BRAND, PRODUCT, sampleListing } from "./fixtures/samples";
import { applyDraft, cleanTags, fromPrice, newListing, pricesFor, sizeSpan } from "./listing";
import { listingDraftBody } from "./listing-schema";
import { draftOf } from "./editor-state";

describe("the listing model", () => {
  it("starts a new listing from the product's name and nothing else", () => {
    const listing = newListing({ brandId: BRAND, productId: PRODUCT, title: "x".repeat(200) });
    expect(listing).toMatchObject({ id: "", status: "draft", mode: "made_to_order", channel: "storefront", prices: {}, media: [], currency: "GBP" });
    expect(listing.title).toHaveLength(140);
    expect(newListing({ brandId: BRAND, productId: PRODUCT, title: "t", currency: "AUD" }).currency).toBe("AUD");
  });

  it("cleans tags: trimmed, lower case, no repeats, at most 13", () => {
    expect(cleanTags([" Club Kit ", "club kit", "", "2027"])).toEqual(["club kit", "2027"]);
    expect(cleanTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(13);
  });

  it("keeps prices only for the design's sizes and only above nothing", () => {
    expect(pricesFor(["S", "M", "L"], { S: 4500, M: 0, XXL: 4800, L: 4500.5 })).toEqual({ S: 4500 });
  });

  it("applies a draft: the result is what is stored", () => {
    const listing = sampleListing();
    const draft = { ...draftOf(listing), tags: ["A", "a", "b"], prices: { M: 5000, XXXL: 9000 }, title: "New" };
    const next = applyDraft(listing, draft, ["S", "M"]);
    expect(next).toMatchObject({ title: "New", tags: ["a", "b"], prices: { M: 5000 }, id: listing.id, status: listing.status });
  });

  it("says the size span and the lowest price", () => {
    expect(sizeSpan(["XS", "S", "M", "3XL"], { S: 1, M: 1, "3XL": 1 })).toBe("S–3XL");
    expect(sizeSpan(["S", "M"], { M: 1 })).toBe("M");
    expect(sizeSpan(["S"], {})).toBe("No sizes priced");
    expect(fromPrice({ S: 4800, M: 4500 })).toBe(4500);
    expect(fromPrice({})).toBeNull();
  });

  it("checks what the editor saves", () => {
    const draft = draftOf(sampleListing());
    expect(listingDraftBody.safeParse(draft).success).toBe(true);
    expect(listingDraftBody.safeParse({ ...draft, personalisation: { ...draft.personalisation, numberMin: 50, numberMax: 10 } }).success).toBe(false);
    expect(listingDraftBody.safeParse({ ...draft, prices: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`s${i}`, 1])) }).success).toBe(false);
    expect(listingDraftBody.safeParse({ ...draft, media: Array.from({ length: 11 }, () => draft.media[0]) }).success).toBe(false);
  });
});
