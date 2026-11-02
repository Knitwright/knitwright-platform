import type { CountryRule } from "@/lib/factory/schemas";
import { taxTreatment, type TaxTreatment } from "@/lib/markets/tax";
import { GAP_RULE_ID, NOT_KNOWN } from "./settings";

/**
 * The VAT treatment of a quote (spec F-T5, "VAT treatment").
 *
 * THE TREATMENT ITSELF IS O3's. `lib/markets/tax.ts` (decision 0104) reads `country_rules` and says
 * what a market charges, and whether Knitwright is registered for it — which matters, because
 * Australia's GST is charged "once registered" and nobody has registered. This file only puts that
 * answer into the shape the document prints, so the quote and the market panel can never disagree
 * about a tax.
 *
 * NO TAX IS ADDED TO A TOTAL HERE, and none is taken off one. The factory's price tiers do not say
 * whether a stored price is before or after tax, so adding a rate to them would make up a number.
 * **Owner question** on the pull request: are the stored sell prices before or after VAT? Until that
 * is answered a quote cannot show a tax-inclusive total, and says so.
 */

export interface VatTreatment {
  /** The two-letter market, or null when none could be read. */
  readonly country: string | null;
  readonly countryName: string;
  /** "20%" or the words for a rate nobody set. */
  readonly rate: string;
  /** The sentence the document prints. Always a full sentence. */
  readonly text: string;
  /** What the row says about itself, such as "Placeholder, to confirm with a customs adviser". */
  readonly label: string;
  readonly ruleId: string;
}

/** Said where no country rule could be read at all. */
export const NO_COUNTRY_RULE =
  "Knitwright could not read a market rule for your delivery country, so no VAT treatment can be stated on this quote. Ask Knitwright before you order.";

/** Said where the market is on file but is not open. */
export const MARKET_CLOSED = (name: string): string =>
  `Knitwright does not sell into ${name} yet, so no VAT treatment is stated on this quote.`;

/** The one sentence that keeps a tax-inclusive reading off the document. */
export const PRICES_AS_STORED =
  "The prices above are the factory's price tiers as stored. Knitwright's factory data does not say whether a tier is before or after tax, so no tax is added to or taken off any figure on this quote.";

/** What the market's own row says, in the words `lib/markets/tax.ts` writes them. */
export const marketTax = (rule: CountryRule): TaxTreatment => taxTreatment(rule);

/**
 * The VAT treatment for one market. Every case says what it knows and what it does not; none of
 * them leaves a blank, and none of them states a figure the rows do not hold.
 */
export function vatTreatment(rule: CountryRule | null): VatTreatment {
  if (rule === null) {
    return { country: null, countryName: NOT_KNOWN, rate: NOT_KNOWN, text: NO_COUNTRY_RULE, label: NOT_KNOWN, ruleId: GAP_RULE_ID };
  }
  if (!rule.sellingEnabled) {
    return { country: rule.country, countryName: rule.name, rate: NOT_KNOWN, text: MARKET_CLOSED(rule.name), label: rule.label, ruleId: rule.ruleId || GAP_RULE_ID };
  }
  const tax = marketTax(rule);
  // The market's own line, then what has to happen for it to change, then the sentence that stops
  // any figure above being read as tax-inclusive.
  const text = [tax.line, tax.missing, PRICES_AS_STORED].filter((part): part is string => part !== null).join(" ");
  return {
    country: rule.country,
    countryName: rule.name,
    rate: tax.rate ?? NOT_KNOWN,
    text,
    label: rule.label,
    ruleId: tax.ruleId || rule.ruleId || GAP_RULE_ID,
  };
}

/** The rule for the market a currency sells into, or null when no row covers it. X6's own mapping. */
export const ruleForCountry = (rules: readonly CountryRule[], country: string): CountryRule | null =>
  rules.find((rule) => rule.country === country) ?? null;
