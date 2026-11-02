import type { SellCurrency } from "@/lib/factory/schemas";
import type { ClubColours, KitStyleId } from "@/lib/kit-styles/presets";
import { GAP_RULE_ID } from "./vocabulary";

/**
 * The "ideas" button on the tool rail (spec F-T1) opens F-T2's suggestions, which workstream Z6
 * builds. Z6 is not merged, so this file holds the smallest interface the rail needs and a
 * deterministic double (Lesson 9). Nothing here imports from Z6's directory, and the double never
 * reaches a network or a model.
 *
 * An idea is an arrangement of colours the club already picked plus one of the kit styles the
 * garment offers. It is never a picture: AI never draws the garment (spec decision 13), so an idea
 * that cannot be expressed as colours and a style is not an idea this seam can carry.
 */

export interface IdeasRequest {
  readonly sportId: string;
  /** The colours the club has now. An idea rearranges these; it does not invent one. */
  readonly colours: ClubColours;
  /** The registry type of the part the person is looking at, so only styles that garment offers come back. */
  readonly typeId: string;
  readonly limit: number;
}

export interface KitIdea {
  readonly id: string;
  /** One line, in Knitwright's own vocabulary. */
  readonly label: string;
  readonly colours: ClubColours;
  readonly pattern: KitStyleId;
  /** The rulebook entry behind the suggestion, or `R-GAP-000` where there is none. */
  readonly ruleId: string;
}

export type IdeasOutcome =
  | Readonly<{ status: "ideas"; ideas: readonly KitIdea[] }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export interface IdeasSource {
  ideasFor(request: IdeasRequest): Promise<IdeasOutcome>;
}

/** Said where crest-to-kit is not wired in. The button is shown and says plainly that it is not ready. */
export const IDEAS_UNAVAILABLE = "Ideas come from crest-to-kit, which is not switched on yet.";

/** The seam's state until the orchestrator wires F-T2 in. It refuses rather than inventing a kit. */
export const unavailableIdeas: IdeasSource = {
  ideasFor: () => Promise.resolve({ status: "unavailable", reason: IDEAS_UNAVAILABLE }),
};

/**
 * The test double: the same ideas every time, in the order given, cut to the request's limit. A test
 * can therefore assert exactly what the rail shows without a model or a network.
 */
export const fixedIdeas = (ideas: readonly KitIdea[]): IdeasSource => ({
  ideasFor: (request) => Promise.resolve({ status: "ideas", ideas: ideas.slice(0, Math.max(0, request.limit)) }),
});

/** Two ideas built from the colours in the request, for tests and for the screen's own test id. */
export const sampleIdeas = (colours: ClubColours): readonly KitIdea[] => [
  { id: "hoops", label: "Hoops in your second colour", colours, pattern: "hoops", ruleId: GAP_RULE_ID },
  { id: "sash", label: "A sash from shoulder to hip", colours, pattern: "sash", ruleId: GAP_RULE_ID },
];

/**
 * The quote the footer's Quote button asks for (spec F-T5), also workstream Z6. The same rule
 * holds: the smallest interface, a deterministic double, and no import from Z6.
 */
export interface QuoteRequest {
  readonly projectId: string;
  readonly version: number;
  readonly lines: readonly Readonly<{ articleCode: string; qty: number }>[];
  readonly currency: SellCurrency;
}

export type QuoteOutcome =
  | Readonly<{ status: "quoted"; quoteNumber: string; downloadPath: string }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export interface QuoteSource {
  quoteFor(request: QuoteRequest): Promise<QuoteOutcome>;
}

/** Said where the quote PDF is not wired in. */
export const QUOTE_UNAVAILABLE = "The quote PDF is not switched on yet. The prices above are the ones it will carry.";

export const unavailableQuotes: QuoteSource = {
  quoteFor: () => Promise.resolve({ status: "unavailable", reason: QUOTE_UNAVAILABLE }),
};

/** The test double: one fixed quote number and path, whatever is asked for. */
export const fixedQuote = (quoteNumber: string, downloadPath: string): QuoteSource => ({
  quoteFor: () => Promise.resolve({ status: "quoted", quoteNumber, downloadPath }),
});
