import type { CardSource, TagKind, TagState } from "./vocabulary";

/**
 * What the inspiration board is made of (decision 0082). Nothing here holds bytes: a card holds the address of a
 * picture a provider serves and the words that go with it, and that is all a moodboard ever stores.
 */

/** One word of the context query, with where it came from. */
export type ContextTag = Readonly<{
  /** Lower case, trimmed, used both as the key and in the search text. */
  text: string;
  kind: TagKind;
}>;

/** The query the board searches with, and the tags a person steered. */
export type ContextQuery = Readonly<{
  tags: readonly ContextTag[];
  /** The tags joined for a search box, longest-lived first: sport, article, colour, style, mood. */
  text: string;
  /** Tags the person removed. Kept so the board does not keep offering them back. */
  removed: readonly string[];
}>;

/** How the person steered the query. A tag can be pinned (kept whatever the design says) or removed. */
export type TagSteer = Readonly<Record<string, TagState>>;

/**
 * Who made a picture and who serves it. `notice` is the one line shown under a card, as each provider's terms ask.
 * Nothing is stored beyond these words and the two addresses.
 */
export type Attribution = Readonly<{
  /** The photographer or designer, when the provider names one. */
  creator: string | null;
  creatorUrl: string | null;
  /** The provider's own name, as its terms require it to be shown. */
  provider: string;
  providerUrl: string | null;
  notice: string;
}>;

/**
 * One card on the board. `previewUrl` is hotlinked from the provider, as Unsplash's and Pexels' terms require; the
 * bytes are never fetched by us, never stored and never written into a design.
 */
export type InspirationCard = Readonly<{
  /** Stable for the same card across refreshes: the source and the provider's own id. */
  id: string;
  source: CardSource;
  sourceLabel: string;
  title: string;
  /** The page the card opens, so every card shows its source and opens it (F-S1 acceptance). */
  openUrl: string;
  /** The picture to show, served by the provider. A data address is only ever an AI mood image of ours. */
  previewUrl: string;
  attribution: Attribution;
  /** Set on an AI mood image, which carries the label wherever it is shown. */
  aiLabel?: string;
  /** True only for Knitwright's own library, the one source a suggestion may be drawn from directly. */
  owned: boolean;
  /** Why this card cannot be saved to a moodboard, or null when it can. */
  unsaveable?: string;
}>;

/** A source that answered, with what it found, or the plain sentence that says why it shows nothing. */
export type SourceResult = Readonly<{
  source: CardSource;
  label: string;
  cards: readonly InspirationCard[];
  /** Null when the source answered. A sentence when its key is missing, it was slow, or it faulted. */
  unavailable: string | null;
}>;

/** The "Search on Behance / Pinterest" buttons: a label and the address the context query opens. */
export type SearchLink = Readonly<{ site: "behance" | "pinterest"; label: string; url: string }>;

/** The whole board, in the spec's source order. */
export type Board = Readonly<{
  query: ContextQuery;
  sources: readonly SourceResult[];
  searchLinks: readonly SearchLink[];
  /** How long the board took to build, in milliseconds. The panel shows nothing of it; the test reads it. */
  tookMs: number;
}>;

/** A saved moodboard item: the address, the preview, the attribution. Never bytes, never third-party HTML. */
export type MoodboardItem = Readonly<{
  id: string;
  source: CardSource;
  title: string;
  openUrl: string;
  previewUrl: string;
  attribution: Attribution;
  addedAt: string;
}>;
