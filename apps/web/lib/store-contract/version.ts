/**
 * The Store contract (plan v5 O2, spec F-S10 and F-L4): what the separate Knitwright Store reads out
 * of this platform, and nothing else.
 *
 * The Store is a different product (owner decision 1). This platform holds no cart, no till, no
 * provider and no shop front, and the one hand-off to production is `submit_order_for_production`.
 * So every endpoint here is a read, every payload is a record of something the platform already
 * holds, and a test in this directory refuses any field a shop would need to take money.
 *
 * Version 2 is the first version with endpoints behind it. Version 1 is the pair of payloads two
 * earlier workstreams already wrote and this contract carries unchanged: the collection drop
 * (`lib/collections/drop.ts`, decision 0085) and the launch listing (`lib/flows/listing.ts`,
 * decision 0096). Both keep their own `payloadVersion`, so a Store reading them can tell a change
 * to one apart from a change to the envelope.
 */

/** The envelope's version. Raised when a field changes meaning, so the Store can tell two shapes apart. */
export const STORE_CONTRACT_VERSION = 2;

/** Where every field of every payload is written down, field by field, with what a missing one means. */
export const CONTRACT_DOCUMENT = "docs/store-contract-v2.md";

/** The kinds of payload this contract serves. One endpoint each. */
export const PAYLOAD_KINDS = ["store-manifest", "store-products", "store-drops", "store-listings", "store-team-stores"] as const;
export type PayloadKind = (typeof PAYLOAD_KINDS)[number];

/** The address of each payload, so the manifest names them rather than a reader guessing. */
export const PAYLOAD_PATHS: Readonly<Record<PayloadKind, string>> = {
  "store-manifest": "/api/store",
  "store-products": "/api/store/products",
  "store-drops": "/api/store/drops",
  "store-listings": "/api/store/listings",
  "store-team-stores": "/api/store/team-stores",
};
