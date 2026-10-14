import type { QuoteStatus } from "@/lib/leads/quote";

/**
 * What is waiting on the person, for the studio home. Made only from what is stored: the empty
 * fields of a design's factory file, its open share links and their votes, and its quote
 * requests. Nothing here reads a clock or the database; the loader passes the facts in.
 */

/** How many things the list shows. The rest are counted. */
export const NEEDS_YOU_SHOWN = 5;

export interface DesignFacts {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  /** How many fields of the factory file are empty, or null when that is not known. */
  readonly toConfirm: number | null;
  /** True when a share link was ever made for the design. */
  readonly shared: boolean;
  /** True when a quote was ever asked for. */
  readonly quoted: boolean;
}

/** The answers left through a design's open share links, added together. */
export interface OpenVote {
  readonly projectId: string;
  readonly projectName: string;
  readonly yes: number;
  readonly notYet: number;
  /** Every answer, including comments without a vote. */
  readonly answers: number;
  /** The newest answer, or the newest link when nobody has answered. */
  readonly latestAt: string;
}

export interface QuoteFact {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly quantity: number;
  readonly status: QuoteStatus;
  readonly updatedAt: string;
}

export type NeedsYouKind = "quote-sent" | "vote" | "confirm" | "share" | "quote-waiting";

export interface NeedsYouItem {
  /** Unique within the list. */
  readonly id: string;
  readonly kind: NeedsYouKind;
  readonly text: string;
  /** The word on the item's link. */
  readonly action: string;
  readonly href: string;
  readonly at: string;
}

export interface NeedsYou {
  readonly items: readonly NeedsYouItem[];
  /** How many more were left out. */
  readonly more: number;
}

/** The order of the kinds: a reply first, then votes, empty fields, sharing, then quotes still waiting. */
const ORDER: readonly NeedsYouKind[] = ["quote-sent", "vote", "confirm", "share", "quote-waiting"];

const designPath = (id: string): string => `/studio/${encodeURIComponent(id)}`;
const count = (value: number): string => value.toLocaleString("en-GB");
const things = (value: number): string => `${count(value)} ${value === 1 ? "thing" : "things"}`;

function designItems(design: DesignFacts): NeedsYouItem[] {
  if (design.toConfirm === null) return [];
  if (design.toConfirm > 0) {
    return [
      {
        id: `confirm:${design.id}`,
        kind: "confirm",
        text: `${design.name}: ${things(design.toConfirm)} to confirm for the factory`,
        action: "Finish",
        href: `${designPath(design.id)}/tech-pack`,
        at: design.updatedAt,
      },
    ];
  }
  if (design.shared || design.quoted) return [];
  return [
    {
      id: `share:${design.id}`,
      kind: "share",
      text: `${design.name}: the factory file has no empty fields. Show it to your committee`,
      action: "Share",
      href: `${designPath(design.id)}?tool=share#share-heading`,
      at: design.updatedAt,
    },
  ];
}

const voteItem = (vote: OpenVote): NeedsYouItem => ({
  id: `vote:${vote.projectId}`,
  kind: "vote",
  text: `${vote.projectName}: committee vote open, ${
    vote.yes + vote.notYet === 0 ? "no votes yet" : `${count(vote.yes)} yes, ${count(vote.notYet)} not yet`
  }`,
  action: "See votes",
  href: `${designPath(vote.projectId)}?tool=share#share-heading`,
  at: vote.latestAt,
});

function quoteItems(quote: QuoteFact): NeedsYouItem[] {
  if (quote.status === "closed") return [];
  const sent = quote.status === "quoted";
  return [
    {
      id: `quote:${quote.id}`,
      kind: sent ? "quote-sent" : "quote-waiting",
      text: sent
        ? `Quote for ${count(quote.quantity)} of ${quote.projectName} sent. Look in your email`
        : `Quote for ${count(quote.quantity)} of ${quote.projectName} asked for. We reply by email`,
      action: "Open",
      href: `${designPath(quote.projectId)}?tool=quote#quote-request`,
      at: quote.updatedAt,
    },
  ];
}

const byOrderThenNewest = (a: NeedsYouItem, b: NeedsYouItem): number =>
  ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id);

export function needsYou(
  input: Readonly<{ designs: readonly DesignFacts[]; votes: readonly OpenVote[]; quotes: readonly QuoteFact[] }>,
  shown: number = NEEDS_YOU_SHOWN,
): NeedsYou {
  const all = [...input.quotes.flatMap(quoteItems), ...input.votes.map(voteItem), ...input.designs.flatMap(designItems)].sort(
    byOrderThenNewest,
  );
  return { items: all.slice(0, shown), more: Math.max(0, all.length - shown) };
}
