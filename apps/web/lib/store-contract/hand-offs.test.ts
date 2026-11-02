import { describe, expect, it } from "vitest";
import { DROP_PAYLOAD_VERSION } from "@/lib/collections/drop";
import { LISTING_KIND, LISTING_PAYLOAD_VERSION } from "@/lib/flows/listing";
import { storeDrops } from "./drops";
import { mediaForDesign, storeListings } from "./listings";
import { dropRow, ids, listingPayloadSample, listingRow } from "./fixtures/samples";

/**
 * The two hand-offs this contract carries unchanged: a collection drop (Z4, decision 0085) and a
 * launch listing (L6, decision 0096). Nothing is rebuilt here, and a row this deploy cannot read is
 * refused by id rather than carried half-read.
 */

describe("drops from collection plans", () => {
  it("carries the stored payload through unchanged, with its own version", () => {
    const { drops } = storeDrops([dropRow()]);

    expect(drops).toHaveLength(1);
    expect(drops[0]?.payload.kind).toBe("collection-drop");
    expect(drops[0]?.payload.payloadVersion).toBe(DROP_PAYLOAD_VERSION);
    expect(drops[0]?.collectionId).toBe(ids.collection);
    expect(drops[0]?.version).toBe(1);
  });

  it("puts the newest first, so a reader that keeps its place can stop early", () => {
    const { drops } = storeDrops([
      dropRow({ dropId: "a", createdAt: "2027-01-01T10:00:00.000Z" }),
      dropRow({ dropId: "b", createdAt: "2027-02-01T10:00:00.000Z" }),
    ]);

    expect(drops.map((drop) => drop.dropId)).toEqual(["b", "a"]);
  });

  it("refuses a row it cannot read, by id, and leaves it out of the list", () => {
    const { drops, refused } = storeDrops([dropRow(), dropRow({ dropId: "bad", payload: { kind: "nonsense" } })]);

    expect(drops.map((drop) => drop.dropId)).toEqual([ids.drop]);
    expect(refused).toEqual([{ id: "bad", reason: expect.stringContaining("Export the drop again"), ruleId: "R-GAP-000" }]);
  });
});

describe("launch packs handed over", () => {
  it("carries L6's payload through unchanged, with its own version and its own note", () => {
    const { listings } = storeListings([listingRow()]);

    expect(listings[0]?.payload.kind).toBe(LISTING_KIND);
    expect(listings[0]?.payload.payloadVersion).toBe(LISTING_PAYLOAD_VERSION);
    expect(listings[0]?.payload.note).toContain("A hand-off, not a publication");
  });

  it("says whether anything has read the hand-off yet, as a state rather than a gap", () => {
    const { listings } = storeListings([listingRow(), listingRow({ listingId: "x", collectedAt: "2027-02-01T00:00:00.000Z", createdAt: "2027-01-01T00:00:00.000Z" })]);

    expect(listings.map((listing) => listing.collected.status)).toEqual(["not-collected", "collected"]);
    expect(listings[1]?.collected).toEqual({ status: "collected", at: "2027-02-01T00:00:00.000Z" });
  });

  it("refuses a row it cannot read, by id", () => {
    const { listings, refused } = storeListings([listingRow({ listingId: "bad", payload: {} })]);

    expect(listings).toEqual([]);
    expect(refused[0]?.reason).toContain("Hand the launch pack over again");
  });

  it("gathers every picture of one design across every hand-off, for that design's product", () => {
    const { listings } = storeListings([
      listingRow(),
      listingRow({ listingId: "second", payload: listingPayloadSample({ designProjectId: "other" }) }),
    ]);

    const media = mediaForDesign(listings, ids.project);
    expect(media).toHaveLength(2);
    expect(media.every((item) => item.listingId === ids.listing)).toBe(true);
    expect(mediaForDesign(listings, "nobody")).toEqual([]);
  });
});
