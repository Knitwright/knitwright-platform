import type { OrganisationType } from "./organisation";

/**
 * The lead score (Platform and Store Guide, page 9): simple points the owner can tune. Change a
 * number here and every lead is scored again the next time the leads page opens.
 */
export const LEAD_POINTS = {
  /** Organisation and type filled in. */
  organisation: 10,
  /** Highest quantity asked for is 50 or more. */
  quantity50: 20,
  /** Highest quantity asked for is 200 or more. Replaces the 50 points, it does not add to them. */
  quantity200: 30,
  /** A needed-by date within NEEDED_SOON_WEEKS. */
  neededSoon: 25,
  /** Shared with others, or a design edited ENGAGED_EDITS times or more. */
  engaged: 15,
  /**
   * The guide says "quote viewed twice or more". Quotes with prices do not exist yet, so this
   * counts quote requests instead.
   */
  quotedTwice: 10,
  /** Paid credits or a sample. Neither exists yet: see paidCreditsOrSample. */
  paid: 40,
  /** In Australia, where the partner can visit. */
  australia: 10,
} as const;

/** From this score a person contacts the lead within 24 hours. */
export const HOT_SCORE = 60;
export const NEEDED_SOON_WEEKS = 12;
/** Saved changes after the first version. */
export const ENGAGED_EDITS = 3;

export interface ScoreInput {
  readonly organisationType: OrganisationType | null;
  readonly country: string | null;
  readonly quotes: readonly { readonly quantity: number; readonly neededBy: string }[];
  /** The most versions any one of the brand's designs has. */
  readonly mostVersions: number;
  /** Hook: sharing with a committee is built on another branch. False until it is joined here. */
  readonly sharedWithOthers: boolean;
  /** Hook: paid credits and samples are not built. False until they are. */
  readonly paidCreditsOrSample: boolean;
}

export interface LeadScore {
  readonly total: number;
  /** Why, in plain words, in the order of the guide. */
  readonly reasons: readonly string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today (UTC) to a date written YYYY-MM-DD. Negative for a past date. */
export const daysUntil = (date: string, now: Date): number => {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / DAY_MS);
};

const quantityPart = (highest: number): [number, string] | null => {
  if (highest >= 200) return [LEAD_POINTS.quantity200, "Quantity 200 or more"];
  if (highest >= 50) return [LEAD_POINTS.quantity50, "Quantity 50 or more"];
  return null;
};

export function leadScore(input: ScoreInput, now: Date): LeadScore {
  const highest = Math.max(0, ...input.quotes.map((quote) => quote.quantity));
  const soon = input.quotes.some((quote) => {
    const days = daysUntil(quote.neededBy, now);
    return days >= 0 && days <= NEEDED_SOON_WEEKS * 7;
  });
  const parts: readonly ([number, string] | null)[] = [
    input.organisationType ? [LEAD_POINTS.organisation, "Organisation and type given"] : null,
    quantityPart(highest),
    soon ? [LEAD_POINTS.neededSoon, `Needed within ${NEEDED_SOON_WEEKS} weeks`] : null,
    input.sharedWithOthers || input.mostVersions - 1 >= ENGAGED_EDITS
      ? [LEAD_POINTS.engaged, input.sharedWithOthers ? "Shared with others" : `Design edited ${ENGAGED_EDITS} times or more`]
      : null,
    input.quotes.length >= 2 ? [LEAD_POINTS.quotedTwice, "Asked for a quote twice or more"] : null,
    input.paidCreditsOrSample ? [LEAD_POINTS.paid, "Paid credits or a sample"] : null,
    input.country === "AU" ? [LEAD_POINTS.australia, "In Australia"] : null,
  ];
  const given = parts.filter((part): part is [number, string] => part !== null);
  return { total: given.reduce((sum, [points]) => sum + points, 0), reasons: given.map(([, reason]) => reason) };
}

export const isHot = (score: number): boolean => score >= HOT_SCORE;
