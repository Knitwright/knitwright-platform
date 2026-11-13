import type { PriceTier } from "@/lib/factory/schemas";
import type { Drop } from "../drops";
import { newListing, type Listing, type MediaItem } from "../listing";
import type { Storefront } from "../rows";

/** Made-up rows for the storefront's tests and its /dev fixture page. Labelled: none is real data. */

export const BRAND = "0b5c7f0e-8a53-4a6f-9d3e-2f7f1c1f0a11";
export const PRODUCT = "4f1d2c3b-5a69-4b7c-8d9e-0f1a2b3c4d5e";
export const LISTING = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";

export const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

export const FLOW_ITEM: MediaItem = { id: "flow-9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", source: "flow", ref: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", label: "Floodlit pitch", aiLabel: "AI-generated" };

export const sampleListing = (over: Partial<Listing> = {}): Listing => ({
  ...newListing({ brandId: BRAND, productId: PRODUCT, title: "Example FC Home Shirt 2027 · Navy & Gold" }),
  id: LISTING,
  description: "The 2027 home shirt. Navy body with gold pinstripes, sublimated so it never cracks or fades.\n\nNames and numbers available.",
  tags: ["football shirt", "club kit", "navy gold", "2027"],
  media: [{ id: "render-front", source: "render", ref: "front", label: "Product render", aiLabel: null }, FLOW_ITEM],
  personalisation: { enabled: true, nameMax: 12, numberMin: 0, numberMax: 99, extraMinor: 500 },
  prices: { XS: 4500, S: 4500, M: 4500, L: 4500, XL: 4500, "2XL": 4800, "3XL": 4800 },
  fabricKey: "mesh-140",
  updatedAt: "2026-11-13T10:00:00.000Z",
  ...over,
});

export const sampleStorefront = (over: Partial<Storefront> = {}): Storefront => ({
  brandId: BRAND,
  slug: "example-fc",
  name: "Example FC shop",
  status: "live",
  returnsPolicy: "Personalised items cannot be returned except for defects.\n\nDefects are remade or refunded within 30 days.",
  euResponsiblePerson: null,
  batchOwner: null,
  ...over,
});

export const sampleDrop = (over: Partial<Drop> = {}): Drop => ({
  id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  brandId: BRAND,
  collectionId: null,
  name: "Home kit drop",
  opensAt: "2026-11-10T10:00:00.000Z",
  closesAt: "2026-11-20T10:00:00.000Z",
  targetUnits: 30,
  status: "scheduled",
  ...over,
});

/** A ladder like the seeded one: placeholder prices, labelled. */
const tier = (over: Partial<PriceTier>): PriceTier => ({
  id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  capabilityId: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
  qtyMin: 10,
  qtyMax: null,
  cost: null,
  sellGbpMinor: 1820,
  sellAudMinor: null,
  personalisationCostMinor: null,
  ruleId: "R-GAP-000",
  label: "Placeholder price, not an owner answer",
  ...over,
});

export const sampleLadder: readonly PriceTier[] = [tier({ qtyMin: 50, sellGbpMinor: 1600 }), tier({ qtyMin: 10, qtyMax: 49 })];
