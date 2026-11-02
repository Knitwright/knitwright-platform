import { describeTier, formatMoney, priceBasket, priceFor, type Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import type { DeliveryLine } from "@/lib/make/delivery";
import { inclusionsFor, type Inclusion, type InclusionInput } from "./inclusions";
import { quoteNumber, validUntil } from "./number";
import { GAP_RULE_ID, NOT_KNOWN, QUOTE_SETTINGS } from "./settings";
import type { VatTreatment } from "./vat";

/**
 * The quote itself (spec F-T5): the number, the price for each piece by tier with the tiers counted
 * across the whole basket, what is included, the delivery estimate, the VAT treatment, thirty days
 * of validity and a link back.
 *
 * EVERY FIGURE COMES FROM `priceFor`. The lines are priced by `priceBasket`, which is X6's own
 * function and which calls `priceFor` per line with the tier read at the whole basket. Nothing here
 * multiplies, rounds or re-derives a price, and `buildQuote` then checks each line against
 * `priceFor` again and REFUSES to build the quote if the two disagree. That is what "the numbers
 * match checkout to the penny" means in code rather than in a comment.
 *
 * A part the factory has no price for is never quietly dropped and never quietly priced: it is
 * listed with the reason, and the total says it leaves that part out.
 */

/** Thrown where a quote cannot be built. It is never caught and turned into a figure. */
export class QuoteRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteRefused";
  }
}

/** One thing being quoted: an article, how many, and the factory's ladder for it. */
export interface QuoteLineInput {
  readonly articleCode: string;
  readonly label: string;
  readonly qty: number;
  readonly ladder: Ladder;
}

/** A part of the kit the factory has no price for, named rather than left out. */
export interface UnpricedPart {
  readonly label: string;
  readonly reason: string;
}

export interface QuoteInput {
  readonly issuedAt: Date;
  readonly clubName: string;
  readonly brandName: string;
  readonly sportId: string;
  readonly sportLabel: string;
  readonly currency: SellCurrency;
  readonly lines: readonly QuoteLineInput[];
  readonly unpriced: readonly UnpricedPart[];
  readonly inclusions: InclusionInput;
  readonly delivery: DeliveryLine;
  readonly vat: VatTreatment;
  /** Where the club goes to carry on: the configurator's own address for this kit. */
  readonly linkBack: string;
  /** The factory the prices came from, as its own row labels it, or null when none could be read. */
  readonly factoryLabel: string | null;
}

export interface QuoteLine {
  readonly articleCode: string;
  readonly label: string;
  readonly qty: number;
  /** "£25.00", or the reason this line has no price. */
  readonly unit: string;
  readonly line: string;
  /** Integer minor units, or null where there is no price. Money is never read back out of words. */
  readonly unitMinor: number | null;
  readonly lineMinor: number | null;
  readonly priced: boolean;
  /** "20-49", so a club can see which tier its order fell in. */
  readonly tier: string;
  /** The stored label of the tier, so no document can read as a factory's own quote. */
  readonly tierLabel: string | null;
  readonly reason: string | null;
}

export interface Quote {
  readonly number: string;
  readonly issuedOn: string;
  readonly validUntil: string;
  readonly validityDays: number;
  readonly clubName: string;
  readonly brandName: string;
  readonly sportLabel: string;
  readonly currency: SellCurrency;
  /** The quantity the tier was read at: every piece the factory prices in this basket. */
  readonly tierQty: number;
  readonly lines: readonly QuoteLine[];
  readonly unpriced: readonly UnpricedPart[];
  readonly totalMinor: number | null;
  /** "£740.00", or the reason there is no total. */
  readonly total: string;
  /** One sentence naming the parts the total leaves out, or null when it leaves none out. */
  readonly totalNote: string | null;
  readonly inclusions: readonly Inclusion[];
  readonly delivery: DeliveryLine;
  readonly vat: VatTreatment;
  readonly linkBack: string;
  readonly factoryLabel: string | null;
  /** The rulebook entries this quote cites. `R-GAP-000` appears where none covers a line. */
  readonly ruleIds: readonly string[];
}

const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

/** Said where the factory has no price at all for anything in the basket. */
export const NO_TOTAL = "Not priced yet";

const lineOf = (input: QuoteLineInput, priced: ReturnType<typeof priceBasket>["lines"][number]): QuoteLine => {
  const price = priced.price;
  if (price.status !== "priced") {
    return {
      articleCode: input.articleCode,
      label: input.label,
      qty: input.qty,
      unit: NO_TOTAL,
      line: NO_TOTAL,
      unitMinor: null,
      lineMinor: null,
      priced: false,
      tier: NOT_KNOWN,
      tierLabel: null,
      reason: price.reason,
    };
  }
  return {
    articleCode: input.articleCode,
    label: input.label,
    qty: input.qty,
    unit: formatMoney(price.unitMinor, price.currency),
    line: formatMoney(price.lineMinor, price.currency),
    unitMinor: price.unitMinor,
    lineMinor: price.lineMinor,
    priced: true,
    tier: describeTier(price.tier),
    tierLabel: price.label,
    reason: null,
  };
};

/**
 * Whether every priced line of a quote is exactly what `priceFor` gives for that ladder, quantity,
 * currency and basket quantity — or the first line where it is not. It re-derives rather than
 * trusting: that is the point. Null means they agree to the penny.
 */
export function priceDisagreement(quote: Quote, input: QuoteInput): string | null {
  for (const [at, line] of quote.lines.entries()) {
    const source = input.lines[at];
    if (source === undefined) return `Line ${at + 1} of the quote has no basket line behind it.`;
    const again = priceFor(source.ladder, source.qty, input.currency, quote.tierQty);
    if (again.status !== "priced") {
      if (line.priced) return `Line ${at + 1} (${source.articleCode}) is priced on the quote but priceFor gives no price.`;
      continue;
    }
    if (!line.priced) return `Line ${at + 1} (${source.articleCode}) has no price on the quote but priceFor gives one.`;
    if (line.unitMinor !== again.unitMinor || line.lineMinor !== again.lineMinor) {
      return `Line ${at + 1} (${source.articleCode}) is ${String(line.unitMinor)} on the quote and ${again.unitMinor} from priceFor.`;
    }
  }
  return null;
}

/** What the quote is numbered from: the club, the sport, the currency and the basket. */
const subjectOf = (input: QuoteInput) => ({
  clubName: input.clubName,
  sportId: input.sportId,
  currency: input.currency,
  lines: input.lines.map((line) => ({ articleCode: line.articleCode, qty: line.qty })),
});

/**
 * The quote for a basket. It refuses rather than guessing: an empty basket has nothing to quote,
 * and a quote whose figures do not match `priceFor` is not built at all.
 */
export function buildQuote(input: QuoteInput): Quote {
  if (input.lines.length === 0) {
    throw new QuoteRefused("There is nothing to quote: no part of this kit has a base article the factory prices.");
  }
  const basket = priceBasket(
    input.lines.map((line) => ({ articleCode: line.articleCode, qty: line.qty, ladder: line.ladder })),
    input.currency,
  );
  const lines = input.lines.map((line, at) => lineOf(line, basket.lines[at]!));
  const pricedLines = lines.filter((line) => line.lineMinor !== null);
  const totalMinor = pricedLines.length === 0 ? null : pricedLines.reduce((sum, line) => sum + (line.lineMinor ?? 0), 0);
  const missing = [...lines.filter((line) => !line.priced).map((line) => line.label), ...input.unpriced.map((part) => part.label)];
  const quote: Quote = {
    number: quoteNumber(input.issuedAt, subjectOf(input)),
    issuedOn: dayOf(input.issuedAt),
    validUntil: validUntil(input.issuedAt),
    validityDays: QUOTE_SETTINGS.validityDays,
    clubName: input.clubName,
    brandName: input.brandName,
    sportLabel: input.sportLabel,
    currency: input.currency,
    tierQty: basket.tierQty,
    lines,
    unpriced: input.unpriced,
    totalMinor,
    total: totalMinor === null ? NO_TOTAL : formatMoney(totalMinor, input.currency),
    totalNote:
      missing.length === 0
        ? null
        : `This total leaves out ${missing.join(" and ")}, which ${missing.length === 1 ? "has" : "have"} no price in the factory data on file.`,
    inclusions: inclusionsFor(input.inclusions),
    delivery: input.delivery,
    vat: input.vat,
    linkBack: input.linkBack,
    factoryLabel: input.factoryLabel,
    ruleIds: [...new Set([...inclusionsFor(input.inclusions).map((one) => one.ruleId), input.vat.ruleId, GAP_RULE_ID])],
  };
  const disagreement = priceDisagreement(quote, input);
  if (disagreement !== null) throw new QuoteRefused(`This quote was not built: its figures do not match the factory's own price. ${disagreement}`);
  return quote;
}
