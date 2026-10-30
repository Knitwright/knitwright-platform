/**
 * The fixed words of the inspiration board (plans/platform-v5.md Z1, spec F-S1, decision 0082).
 *
 * Inspiration informs; it never lands on the garment as pixels. Every word a person reads about a card, a source or a
 * suggestion is here, so the panel, the board and the database all say the same thing.
 */

/** The card sources, in the order F-S1 lists them. The board shows them in this order and nothing re-sorts it. */
export const CARD_SOURCES = ["knitwright-library", "pinterest-board", "unsplash", "pexels", "link-preview", "ai-mood"] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

/** What a card's source chip says. Every card shows its source and opens it. */
export const SOURCE_LABELS: Readonly<Record<CardSource, string>> = {
  "knitwright-library": "Knitwright library",
  "pinterest-board": "Your Pinterest board",
  unsplash: "Unsplash",
  pexels: "Pexels",
  "link-preview": "Product link",
  "ai-mood": "AI mood image",
};

/** The label an AI mood image carries wherever it is shown (F-S1: "marked AI mood image"). */
export const AI_MOOD_LABEL = "AI mood image";

/** The one sentence that goes with every AI mood image. */
export const AI_MOOD_NOTE = "Made by a model from your tags, for inspiration only. It never goes on the garment.";

/** Where a tag came from. A person can pin or remove any of them to steer the board. */
export const TAG_KINDS = ["sport", "article", "colour", "style", "mood", "pinned"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const TAG_KIND_LABELS: Readonly<Record<TagKind, string>> = {
  sport: "Sport",
  article: "Article",
  colour: "Colour",
  style: "Style",
  mood: "Brand mood",
  pinned: "Pinned by you",
};

/** How a tag was steered. A tag with no row is simply shown. */
export const TAG_STATES = ["pinned", "removed"] as const;
export type TagState = (typeof TAG_STATES)[number];

/**
 * The board refreshes within 3 seconds of a change (F-S1 acceptance). The budget is the whole board's, so a slow
 * source is dropped with a message rather than holding the others up.
 */
export const REFRESH_BUDGET_MS = 3_000;

/** What one source is given of that budget, so the slowest cannot spend it all. */
export const SOURCE_BUDGET_MS = 2_000;

/** At most three suggestion cards (F-S1). */
export const MAX_SUGGESTIONS = 3;

/** At most this many cards per source, so one source cannot fill the panel. */
export const CARDS_PER_SOURCE = 8;

/** The most tags a context query carries. A longer query searches worse, not better. */
export const MAX_TAGS = 12;

/**
 * Every finding, card and suggestion carries a rule id (spec decision 11). The rulebook has no inspiration entries
 * yet and the plan forbids inventing a rule's text, so each one is the gap id and is listed in the PR.
 */
export const RULE_GAP = "R-GAP-000";

/** What the board says when a provider's key is not set. The feature degrades; nothing fails. */
export const noKeySentence = (label: string, key: string): string =>
  `${label} is not switched on here, so it shows nothing. Knitwright needs ${key} for it.`;

/** What the board says when a source did not answer inside its share of the refresh budget. */
export const slowSentence = (label: string): string => `${label} did not answer in time, so it shows nothing. Try again.`;

/** What the board says when a source answered with a fault. */
export const faultSentence = (label: string): string => `${label} could not be reached, so it shows nothing. Try again.`;
