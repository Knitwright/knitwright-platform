import type { CountryRule } from "@/lib/factory/schemas";
import { GAP_RULE_ID, NOT_KNOWN } from "./settings";

/**
 * The VAT treatment of a quote (spec F-T5, "VAT treatment"), read from `country_rules` — X6's own
 * rows (decision 0071) — and from nowhere else.
 *
 * NO TAX IS ADDED TO A TOTAL HERE, and none is taken off one. The factory's price tiers do not say
 * whether a stored price is before or after tax, so adding a rate to them would make up a number.
 * What a quote carries instead is the treatment: which market, what rate the row holds, the label
 * the row carries about itself, and the plain statement that the prices above are the tiers as
 * stored. **Owner question** on the pull request: are the stored sell prices before or after VAT?
 * Until that is answered a quote cannot show a tax-inclusive total, and says so.
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

/** Said where the row carries no rate. */
export const NO_RATE = (name: string): string =>
  `No VAT or GST rate is set for ${name} in Knitwright's market rules, so none is stated on this quote. The prices above are the factory's price tiers as stored.`;

/** The one sentence that keeps a tax-inclusive reading off the document. */
export const PRICES_AS_STORED =
  "The prices above are the factory's price tiers as stored. Knitwright's factory data does not say whether a tier is before or after tax, so no tax is added to or taken off any figure on this quote.";

/** A rate in basis points as a percentage a person reads: 2000 is "20%", 1050 is "10.5%". */
export const ratePercent = (basisPoints: number): string => `${Number((basisPoints / 100).toFixed(2))}%`;

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
  if (rule.vatRateBp === null) {
    return { country: rule.country, countryName: rule.name, rate: NOT_KNOWN, text: NO_RATE(rule.name), label: rule.label, ruleId: rule.ruleId || GAP_RULE_ID };
  }
  const rate = ratePercent(rule.vatRateBp);
  return {
    country: rule.country,
    countryName: rule.name,
    rate,
    text: `VAT or GST in ${rule.name} is ${rate} in Knitwright's market rules. ${PRICES_AS_STORED}`,
    label: rule.label,
    ruleId: rule.ruleId || GAP_RULE_ID,
  };
}

/** The rule for the market a currency sells into, or null when no row covers it. X6's own mapping. */
export const ruleForCountry = (rules: readonly CountryRule[], country: string): CountryRule | null =>
  rules.find((rule) => rule.country === country) ?? null;
