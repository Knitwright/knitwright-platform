import type { ListingPayload } from "@/lib/flows/listing";
import type { Refused } from "./drops";
import { GAP_RULE_ID } from "./gap";
import { listingPayloadSchema } from "./schemas";

/**
 * Listings, from L6's flows (plan v5 O2; spec F-L4, decision 0096).
 *
 * "Publish to store" publishes nothing. It writes a listing payload — which pictures and clips of a
 * finished run a listing may use, what a model made, and the true-colour picture that goes beside
 * each AI scene — and `flow_listings` keeps it, append-only. That payload is the one this contract
 * hands over, unchanged. No second listing payload is written anywhere in this directory.
 *
 * `collected` is the row's own `collected_at`, and it is a state rather than a gap: "nothing has
 * read this yet" is a fact the platform holds, not a figure it is missing. Setting it is a write,
 * and this contract only reads (see the decision record).
 */

export interface ListingRow {
  readonly listingId: string;
  readonly brandId: string;
  readonly launchProjectId: string;
  readonly createdAt: string;
  readonly collectedAt: string | null;
  readonly payload: unknown;
}

export type Collected = Readonly<{ status: "collected"; at: string }> | Readonly<{ status: "not-collected" }>;

export interface StoreListing {
  readonly listingId: string;
  readonly brandId: string;
  readonly launchProjectId: string;
  readonly handedOverAt: string;
  readonly collected: Collected;
  /** L6's payload, word for word, with its own `payloadVersion` and its own note. */
  readonly payload: ListingPayload;
}

export interface StoreListings {
  readonly listings: readonly StoreListing[];
  readonly refused: readonly Refused[];
}

const REASON = "The stored payload is not a shape this contract recognises. Hand the launch pack over again from the flow canvas.";

const collectedOf = (at: string | null): Collected => (at === null ? { status: "not-collected" } : { status: "collected", at });

/** Newest first. A row this deploy cannot parse is refused by id rather than carried half-read. */
export function storeListings(rows: readonly ListingRow[]): StoreListings {
  const listings: StoreListing[] = [];
  const refused: Refused[] = [];
  for (const row of rows) {
    const parsed = listingPayloadSchema.safeParse(row.payload);
    if (!parsed.success) {
      refused.push({ id: row.listingId, reason: REASON, ruleId: GAP_RULE_ID });
      continue;
    }
    listings.push({
      listingId: row.listingId,
      brandId: row.brandId,
      launchProjectId: row.launchProjectId,
      handedOverAt: row.createdAt,
      collected: collectedOf(row.collectedAt),
      payload: parsed.data,
    });
  }
  return { listings: listings.sort((a, b) => b.handedOverAt.localeCompare(a.handedOverAt)), refused };
}

/** Every picture of one design, across every hand-off, so a product's media is the whole of it. */
export function mediaForDesign(listings: readonly StoreListing[], designProjectId: string) {
  return listings
    .filter((listing) => listing.payload.designProjectId === designProjectId)
    .flatMap((listing) => listing.payload.media.map((item) => ({ ...item, listingId: listing.listingId })));
}
