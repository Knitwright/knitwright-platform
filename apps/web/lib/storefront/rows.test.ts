import { describe, expect, it } from "vitest";
import { sampleListing } from "./fixtures/samples";
import { listingWrite, toBatch, toDrop, toListing, toShopOrder, toStorefront } from "./rows";

const ID = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";
const BRAND = "0b5c7f0e-8a53-4a6f-9d3e-2f7f1c1f0a11";

describe("the storefront rows", () => {
  it("reads a storefront", () => {
    expect(toStorefront({ brand_id: BRAND, slug: "lions", name: "Lions", status: "live", returns_policy: "p", eu_responsible_person: null, batch_owner: null })).toEqual({
      brandId: BRAND, slug: "lions", name: "Lions", status: "live", returnsPolicy: "p", euResponsiblePerson: null, batchOwner: null,
    });
  });

  it("writes a listing and reads it back the same", () => {
    const listing = sampleListing({ status: "published", releaseId: ID, publishedAt: "2026-11-13T10:00:00Z" });
    const written = listingWrite(listing, "u");
    expect(written).toMatchObject({ personalisation: true, name_max: 12, personalisation_minor: 500, fabric_key: "mesh-140", updated_by: "u" });
    const row = { ...written, id: listing.id, brand_id: listing.brandId, product_id: listing.productId, release_id: ID, status: "published", published_at: listing.publishedAt, updated_at: listing.updatedAt, personalisation_minor: "500", prices: { S: "4500" } };
    expect(toListing(row)).toEqual({ ...listing, prices: { S: 4500 } });
    expect(() => toListing({ ...row, status: "sold" })).toThrow();
  });

  it("reads drops, shop orders and batches", () => {
    expect(toDrop({ id: ID, brand_id: BRAND, collection_id: null, name: "Drop", opens_at: "a", closes_at: "b", target_units: 30, status: "scheduled" })).toMatchObject({ targetUnits: 30, status: "scheduled" });
    expect(toShopOrder({ id: ID, brand_id: BRAND, listing_id: ID, drop_id: null, payment_id: ID, size: "M", qty: 2, amount_minor: "9000", currency: "GBP", personal_name: "ALI", personal_number: 7, batch_id: null, access_hash: "h", created_at: "c" })).toMatchObject({ amountMinor: 9000, personalNumber: 7 });
    expect(toBatch({ id: ID, brand_id: null, listing_id: ID, drop_id: null, kind: "weekly", cutoff_at: "c", sizes: { M: 3 }, pieces: 3, status: "open", order_id: null, message: null })).toMatchObject({ kind: "weekly", pieces: 3, brandId: null });
  });
});
