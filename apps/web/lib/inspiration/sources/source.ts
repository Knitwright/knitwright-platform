import type { ContextQuery, InspirationCard } from "../types";
import type { CardSource } from "../vocabulary";
import { SOURCE_LABELS } from "../vocabulary";

/**
 * One source of cards. Every source is an interface with a deterministic stub, so no test and no local run makes a
 * paid or third-party call (plan rule). A source whose key is absent is not built at all: the board shows the plain
 * sentence `unavailable` carries instead, and the rest of the board works.
 */
export interface CardProvider {
  readonly source: CardSource;
  /** The provider's own name, for the log. Never shown. */
  readonly name: string;
  readonly search: (query: ContextQuery, signal?: AbortSignal) => Promise<readonly InspirationCard[]>;
}

/** A source that is switched off, with the sentence that says so. */
export type OffSource = Readonly<{ source: CardSource; unavailable: string }>;

export type MaybeProvider = CardProvider | OffSource;

export const isProvider = (entry: MaybeProvider): entry is CardProvider => "search" in entry;

export const labelOf = (source: CardSource): string => SOURCE_LABELS[source];

/** A fetch function, so tests supply their own and nothing reaches the network. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The shape every adapter builds a card with, so the source and its label are never out of step. */
export const card = (source: CardSource, parts: Omit<InspirationCard, "source" | "sourceLabel">): InspirationCard => ({
  ...parts,
  source,
  sourceLabel: labelOf(source),
});
