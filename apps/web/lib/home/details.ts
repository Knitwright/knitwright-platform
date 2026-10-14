import type { QuoteStatus } from "@/lib/leads/quote";
import type { ProjectSummary } from "@/lib/projects/service";
import type { Thumbnail } from "./card";
import { openVotes, type HomeAnswer, type HomeLink } from "./facts";
import { journeyStep, type JourneyStepId } from "./journey";
import { needsYou, type DesignFacts, type NeedsYou, type QuoteFact } from "./needs-you";

/**
 * The part of the studio home that waits on the slower reads: each card's step and drawing, and
 * the "Needs you" list. Plain data in, plain data out; the loader does the reading.
 */

/** Each design's empty fields and drawing, or nulls when the design could not be read. */
export interface ContentFacts {
  readonly toConfirm: number | null;
  readonly thumbnail: Thumbnail | null;
}

/** Whether a design was ever shared, quoted or downloaded. */
export interface Marks {
  readonly shared: boolean;
  readonly quoted: boolean;
  readonly downloaded: boolean;
}

export interface HomeQuote {
  readonly id: string;
  readonly projectId: string;
  readonly quantity: number;
  readonly status: QuoteStatus;
  readonly updatedAt: string;
}

export interface CardDetail {
  readonly step: JourneyStepId;
  readonly thumbnail: Thumbnail | null;
}

export interface HomeDetails {
  /** The step and drawing of each design on the page, by id. */
  readonly cards: ReadonlyMap<string, CardDetail>;
  readonly needsYou: NeedsYou;
}

export interface DetailsInput {
  /** The designs on this page of the home. */
  readonly shown: readonly ProjectSummary[];
  /** The designs changed most recently, which the "Needs you" list looks at. */
  readonly recent: readonly ProjectSummary[];
  readonly facts: ReadonlyMap<string, ContentFacts>;
  readonly marks: ReadonlyMap<string, Marks>;
  readonly links: readonly HomeLink[];
  readonly answers: readonly HomeAnswer[];
  readonly quotes: readonly HomeQuote[];
  /** The name of every design the reads brought, by id. */
  readonly names: ReadonlyMap<string, string>;
  readonly now: Date;
}

export const EMPTY_DETAILS: HomeDetails = { cards: new Map(), needsYou: { items: [], more: 0 } };

const UNKNOWN: ContentFacts = { toConfirm: null, thumbnail: null };
const NO_MARKS: Marks = { shared: false, quoted: false, downloaded: false };

/** The designs whose content is read: the page's, then the recent ones not on it, each once. */
export function designsToRead(shown: readonly ProjectSummary[], recent: readonly ProjectSummary[]): ProjectSummary[] {
  const onPage = new Set(shown.map((entry) => entry.id));
  return [...shown, ...recent.filter((entry) => !onPage.has(entry.id))];
}

/** The designs named by a link or a quote whose names the other reads did not bring, each once. */
export function namesToRead(
  known: ReadonlyMap<string, string>,
  links: readonly Pick<HomeLink, "projectId">[],
  quotes: readonly Pick<HomeQuote, "projectId">[],
): string[] {
  return [...new Set([...links, ...quotes].map((entry) => entry.projectId))].filter((id) => !known.has(id));
}

export function homeDetails(input: DetailsInput): HomeDetails {
  const factsOf = (id: string): ContentFacts => input.facts.get(id) ?? UNKNOWN;
  const marksOf = (id: string): Marks => input.marks.get(id) ?? NO_MARKS;

  const cards = new Map(
    input.shown.map((design) => [
      design.id,
      { step: journeyStep({ toConfirm: factsOf(design.id).toConfirm, ...marksOf(design.id) }), thumbnail: factsOf(design.id).thumbnail },
    ]),
  );
  const designs: DesignFacts[] = input.recent.map((design) => ({
    id: design.id,
    name: design.name,
    updatedAt: design.updatedAt,
    toConfirm: factsOf(design.id).toConfirm,
    shared: marksOf(design.id).shared,
    quoted: marksOf(design.id).quoted,
  }));
  const quotes: QuoteFact[] = input.quotes.flatMap((quote) => {
    const projectName = input.names.get(quote.projectId);
    return projectName === undefined ? [] : [{ ...quote, projectName }];
  });
  return { cards, needsYou: needsYou({ designs, votes: openVotes(input.links, input.answers, input.names, input.now), quotes }) };
}
