import type { HealthFacts, HealthLine } from "./health";
import { listingHealth } from "./health";
import { MAX_MEDIA, type Listing, type ListingDraft, type MediaItem } from "./listing";
import { priceRows, type PriceRow, type UnitCost } from "./pricing";

/**
 * The listing editor's state (09 screen 23), kept pure so the page's arithmetic is tested: the draft the form holds,
 * money typed as text, the live price rows and the live health checklist the aside shows while a person types.
 */

/** The draft a saved (or new) listing starts the form with. */
export function draftOf(listing: Listing): ListingDraft {
  return {
    productId: listing.productId,
    title: listing.title,
    description: listing.description,
    tags: [...listing.tags],
    showSizeTable: listing.showSizeTable,
    media: [...listing.media],
    personalisation: { ...listing.personalisation },
    currency: listing.currency,
    prices: { ...listing.prices },
    mode: listing.mode,
    channel: listing.channel,
    hideUntilReady: listing.hideUntilReady,
    syncMockups: listing.syncMockups,
    fabricKey: listing.fabricKey,
  };
}

/** "45", "45.5", "£45.00" → 4500 minor units; anything else null. Never more than 100,000.00. */
export function toMinor(text: string): number | null {
  const cleaned = text.replace(/[£$,\s]|AUD|A\$/gi, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 4500 → "45.00", for an input's value. */
export const majorText = (minor: number | null | undefined): string => (minor === null || minor === undefined ? "" : (minor / 100).toFixed(2));

/** The draft with one size's price set from typed text: a blank or unreadable value removes the size from sale. */
export function withPrice(draft: ListingDraft, size: string, text: string): ListingDraft {
  const minor = toMinor(text);
  const prices = { ...draft.prices };
  if (minor === null || minor === 0) delete prices[size];
  else prices[size] = minor;
  return { ...draft, prices };
}

/** The same price for every size, as "Apply to all sizes" does. */
export function withEveryPrice(draft: ListingDraft, sizes: readonly string[], text: string): ListingDraft {
  return sizes.reduce((next, size) => withPrice(next, size, text), draft);
}

/** Adds or removes one picture. The first picked is the primary one; at most ten. */
export function toggleMedia(draft: ListingDraft, item: MediaItem): ListingDraft {
  const has = draft.media.some((one) => one.id === item.id);
  if (has) return { ...draft, media: draft.media.filter((one) => one.id !== item.id) };
  return draft.media.length >= MAX_MEDIA ? draft : { ...draft, media: [...draft.media, item] };
}

/** Makes one picture the primary one: it moves to the front, the rest keep their order. */
export function makePrimary(draft: ListingDraft, id: string): ListingDraft {
  const item = draft.media.find((one) => one.id === id);
  return item ? { ...draft, media: [item, ...draft.media.filter((one) => one.id !== id)] } : draft;
}

/** Adds a typed tag (comma or Enter), keeping the 13-tag limit. */
export function withTag(draft: ListingDraft, raw: string): ListingDraft {
  const tags = raw
    .split(",")
    .map((tag) => tag.trim().toLowerCase().slice(0, 30))
    .filter((tag) => tag.length > 0);
  return { ...draft, tags: [...new Set([...draft.tags, ...tags])].slice(0, 13) };
}

export const withoutTag = (draft: ListingDraft, tag: string): ListingDraft => ({ ...draft, tags: draft.tags.filter((one) => one !== tag) });

/** The listing as the draft would save it, for the live preview and health. */
export const previewOf = (listing: Listing, draft: ListingDraft): Listing => ({ ...listing, ...draft, tags: draft.tags, media: draft.media });

export interface LiveView {
  readonly rows: readonly PriceRow[];
  readonly health: readonly HealthLine[];
}

/** The price rows and health checklist for what is typed now. */
export function liveView(listing: Listing, draft: ListingDraft, sizes: readonly string[], cost: UnitCost, facts: Omit<HealthFacts, "rows">): LiveView {
  const rows = priceRows(sizes, draft.prices, cost);
  return { rows, health: listingHealth(previewOf(listing, draft), { ...facts, rows }) };
}

/** "Last saved 2 minutes ago", "Not saved yet". */
export function savedLine(savedAt: string | null, now: Date): string {
  if (savedAt === null) return "Not saved yet";
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(savedAt)) / 60_000));
  if (minutes < 1) return "Last saved just now";
  if (minutes < 60) return `Last saved ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Last saved ${hours} ${hours === 1 ? "hour" : "hours"} ago` : `Last saved ${new Date(savedAt).toISOString().slice(0, 10)}`;
}
