/**
 * THE LISTING MODEL (plan v6 C3, decision 0154; 09 screen 23; spec F-L5).
 *
 * One product as it is sold: its words, its pictures, personalisation, a retail price per size, what it is made
 * from and where it is published. It is the one listing record in the platform: the storefront sells from it, and
 * C4 (sales channels) reads it to push a product to Shopify. Money is integer minor units in the listing's currency.
 */

export const LISTING_STATUSES = ["draft", "published", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_MODES = ["made_to_order", "drop"] as const;
export type ListingMode = (typeof LISTING_MODES)[number];

/** Where the listing is published (the Publishing section's radio cards). Shopify is pushed by C4. */
export const CHANNELS = ["storefront", "shopify", "team_store"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CURRENCIES = ["GBP", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MAX_MEDIA = 10;
export const MAX_TAGS = 13;
export const MAX_TAG_LENGTH = 30;
export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 5000;

/**
 * A picture of the listing. `render` is the platform's own drawing of the design (always true to colour);
 * `flow` is a picture or clip handed over from a Mockup studio or Flow run (`flow_listings`), carrying "AI-generated"
 * where a model made or touched it, so a storefront can never show an AI scene as a photograph.
 */
export interface MediaItem {
  readonly id: string;
  readonly source: "render" | "flow";
  /** For a render, the view ("front"); for a flow item, the file id. */
  readonly ref: string;
  readonly label: string;
  readonly aiLabel: string | null;
}

export interface Personalisation {
  readonly enabled: boolean;
  readonly nameMax: number;
  readonly numberMin: number;
  readonly numberMax: number;
  readonly extraMinor: number;
}

export interface Listing {
  readonly id: string;
  readonly brandId: string;
  readonly productId: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly showSizeTable: boolean;
  readonly media: readonly MediaItem[];
  readonly personalisation: Personalisation;
  readonly currency: Currency;
  /** Retail per size label, in minor units. A size with no price is not sold. */
  readonly prices: Readonly<Record<string, number>>;
  readonly mode: ListingMode;
  readonly channel: Channel;
  readonly hideUntilReady: boolean;
  readonly syncMockups: boolean;
  readonly releaseId: string | null;
  readonly fabricKey: string | null;
  readonly status: ListingStatus;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
}

/** The spec's personalisation (09 screen 23: "names and numbers (12 letters, 0–99, +£5)"); the extra is the seller's. */
export const DEFAULT_PERSONALISATION: Personalisation = { enabled: false, nameMax: 12, numberMin: 0, numberMax: 99, extraMinor: 0 };

/** A listing not yet saved: the product's name as its title, nothing else assumed. */
export function newListing(input: Readonly<{ brandId: string; productId: string; title: string; currency?: Currency }>): Listing {
  return {
    id: "",
    brandId: input.brandId,
    productId: input.productId,
    title: input.title.slice(0, TITLE_MAX),
    description: "",
    tags: [],
    showSizeTable: true,
    media: [],
    personalisation: DEFAULT_PERSONALISATION,
    currency: input.currency ?? "GBP",
    prices: {},
    mode: "made_to_order",
    channel: "storefront",
    hideUntilReady: true,
    syncMockups: true,
    releaseId: null,
    fabricKey: null,
    status: "draft",
    publishedAt: null,
    updatedAt: new Date(0).toISOString(),
  };
}

/** What the editor saves (`listing-schema.ts` checks it on the server). The brand and the product come from the server. */
export interface ListingDraft {
  readonly productId: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly showSizeTable: boolean;
  readonly media: readonly MediaItem[];
  readonly personalisation: Personalisation;
  readonly currency: Currency;
  readonly prices: Readonly<Record<string, number>>;
  readonly mode: ListingMode;
  readonly channel: Channel;
  readonly hideUntilReady: boolean;
  readonly syncMockups: boolean;
  readonly fabricKey: string | null;
}

/** Tags as a person types them: trimmed, lower-cased, without repeats, at most 13. */
export function cleanTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const one = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (one.length > 0) seen.add(one);
  }
  return [...seen].slice(0, MAX_TAGS);
}

/** Prices kept only for the design's own sizes, and only where a price above nothing was typed. */
export function pricesFor(sizes: readonly string[], prices: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  return Object.fromEntries(sizes.flatMap((size) => (Number.isInteger(prices[size]) && (prices[size] ?? 0) > 0 ? [[size, prices[size] as number]] : [])));
}

/** The draft applied to a listing: the result is what is stored. The first picture is the primary one. */
export function applyDraft(listing: Listing, draft: ListingDraft, sizes: readonly string[]): Listing {
  return {
    ...listing,
    title: draft.title,
    description: draft.description,
    tags: cleanTags(draft.tags),
    showSizeTable: draft.showSizeTable,
    media: draft.media.slice(0, MAX_MEDIA),
    personalisation: draft.personalisation,
    currency: draft.currency,
    prices: pricesFor(sizes, draft.prices),
    mode: draft.mode,
    channel: draft.channel,
    hideUntilReady: draft.hideUntilReady,
    syncMockups: draft.syncMockups,
    fabricKey: draft.fabricKey,
  };
}

/** "XS–3XL": the first and last size sold, in the design's order. */
export function sizeSpan(sizes: readonly string[], prices: Readonly<Record<string, number>>): string {
  const sold = sizes.filter((size) => (prices[size] ?? 0) > 0);
  if (sold.length === 0) return "No sizes priced";
  return sold.length === 1 ? sold[0]! : `${sold[0]}–${sold[sold.length - 1]}`;
}

/** The lowest retail price, which the preview card and the storefront grid show as "from". */
export function fromPrice(prices: Readonly<Record<string, number>>): number | null {
  const values = Object.values(prices).filter((value) => value > 0);
  return values.length === 0 ? null : Math.min(...values);
}

export const STATUS_LABELS: Readonly<Record<ListingStatus, string>> = { draft: "Draft", published: "Published", archived: "Archived" };

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  storefront: "Knitwright storefront",
  shopify: "Shopify",
  team_store: "Knitwright team store",
};
