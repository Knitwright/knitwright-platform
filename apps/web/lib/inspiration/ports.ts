import type { GarmentSpec } from "@/lib/garment";
import type { ValidationResult } from "@/lib/validation/validate";
import type { InspirationCard } from "./types";
import type { ContextQuery } from "./types";

/**
 * What the inspiration board reads from the workstreams built beside it (plan v5 Lessons 9). Each is the smallest
 * interface this library needs, with an unwired version that says "nothing known" and raises nothing. The orchestrator
 * wires the real ones; nothing here imports another workstream's unmerged directory.
 */

/** The base article of the design, as the catalogue (X1) knows it. */
export interface ArticleContext {
  /** The article's name and sport tags, or null when the design sits on no article the catalogue offers. */
  readonly articleFor: (typeId: string) => Promise<Readonly<{ name: string; sportTags: readonly string[] }> | null>;
}

/** The brand kit's mood words (Y6, brand studio). Until it is wired there are none, and the query is shorter. */
export interface BrandMoodReader {
  readonly moodWordsFor: (brandId: string) => Promise<readonly string[]>;
}

/** One item Knitwright itself owns: a template, a past design the brand gave permission for, or a sample photo. */
export type LibraryItem = Readonly<{
  id: string;
  title: string;
  /** Where in Knitwright the item opens. */
  openUrl: string;
  /** A picture Knitwright serves. Our own file, so no third-party terms apply. */
  previewUrl: string;
  /** The tags the item is matched on, lower case. */
  tags: readonly string[];
  /** What kind of thing it is, for the card's words: "Template", "Past design", "Sample photo". */
  kindLabel: string;
}>;

/**
 * Knitwright's own library (templates, past designs with permission, golden-sample photos). A past design is only
 * ever listed when its brand gave permission; that is the library's decision, not this board's.
 */
export interface LibraryReader {
  readonly search: (brandId: string, query: ContextQuery, signal?: AbortSignal) => Promise<readonly LibraryItem[]>;
}

/**
 * Validation (X4). Every suggested patch goes through this before it is shown, so an invalid suggestion is never
 * offered. `lib/inspiration/server.ts` wires it to `validateDesign` over the standard registry.
 */
export type DesignChecker = (after: GarmentSpec, signal?: AbortSignal) => Promise<ValidationResult>;

/** Moderation (X8, decision 0073) on the words a model wrote and on a card's title. A blocked card is not shown. */
export interface CardScreen {
  readonly screen: (cards: readonly InspirationCard[]) => Promise<readonly InspirationCard[]>;
}

export const UNWIRED_ARTICLES: ArticleContext = { articleFor: async () => null };
export const UNWIRED_MOOD: BrandMoodReader = { moodWordsFor: async () => [] };
export const UNWIRED_LIBRARY: LibraryReader = { search: async () => [] };
/** Until moderation is wired here, cards are shown as the provider gave them. */
export const UNWIRED_SCREEN: CardScreen = { screen: async (cards) => cards };

export interface InspirationPorts {
  readonly articles: ArticleContext;
  readonly mood: BrandMoodReader;
  readonly library: LibraryReader;
  readonly screen: CardScreen;
}

export const UNWIRED_INSPIRATION_PORTS: InspirationPorts = {
  articles: UNWIRED_ARTICLES,
  mood: UNWIRED_MOOD,
  library: UNWIRED_LIBRARY,
  screen: UNWIRED_SCREEN,
};
