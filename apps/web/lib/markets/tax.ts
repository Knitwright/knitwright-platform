import { formatMoney } from "@/lib/factory/pricing";
import type { CountryRule } from "@/lib/factory/schemas";
import { GAP_RULE_ID } from "@/lib/factory/schemas";

/**
 * What a market charges on a sale, and when the seller has to register for it (spec F-S8 and the
 * Checkout line of F-T5: "VAT is charged at checkout for the UK; GST for Australia once registered";
 * plan v5 O3, decision 0102).
 *
 * Every figure is a column of `country_rules`, never a literal here: the rate, the registration
 * threshold, whether Knitwright is registered, and where those came from. Two rules hold whatever the
 * row says:
 *
 *   1. **Nothing is ever shown as charged while the row says the seller is not registered.** Australia's
 *      GST is charged "once registered" and nobody has registered, so the market's line says the price
 *      carries no GST yet. A platform that showed GST on a price it does not collect would be wrong in
 *      the one direction that costs a club money.
 *   2. **A missing figure is named, never filled in.** No rate, no threshold and no source each read as
 *      what they are, with the rule that would explain them. No rulebook entry covers a tax, so the
 *      rule id is `R-GAP-000` and the pull request lists it.
 */

export type TaxState = "charged" | "not-registered" | "not-recorded";

/** What a market's row says about tax. The whole row is not needed, so the whole row is not asked for. */
export type TaxFacts = Pick<
  CountryRule,
  "name" | "currency" | "taxName" | "vatRateBp" | "taxRegistered" | "taxRegistrationThresholdMinor" | "taxSource"
>;

export interface TaxTreatment {
  readonly state: TaxState;
  /** 'VAT', 'GST', or null while the row names neither. */
  readonly name: string | null;
  /** The rate in percent, as text ("10%"), or null when the row has none. */
  readonly rate: string | null;
  /** "Registered above A$75,000.00 of sales", or null when no threshold is recorded. */
  readonly threshold: string | null;
  /** One line a screen can show as it is. */
  readonly line: string;
  /** What has to happen for the line to change, or null when nothing is missing. */
  readonly missing: string | null;
  /** Where the figures came from, quoted from the row. Null: nowhere. */
  readonly source: string | null;
  readonly ruleId: string;
}

/** 2000 basis points as "20%", with no trailing zeros. */
const percentOf = (basisPoints: number): string => `${Number((basisPoints / 100).toFixed(2))}%`;

const thresholdOf = (rule: TaxFacts): string | null =>
  rule.taxRegistrationThresholdMinor === null
    ? null
    : `Registered above ${formatMoney(rule.taxRegistrationThresholdMinor, rule.currency)} of sales`;

/** What the market charges, in one line, from the row and nothing else. */
export function taxTreatment(rule: TaxFacts): TaxTreatment {
  const name = rule.taxName;
  const rate = rule.vatRateBp === null ? null : percentOf(rule.vatRateBp);
  const threshold = thresholdOf(rule);
  const shared = { name, rate, threshold, source: rule.taxSource, ruleId: GAP_RULE_ID };
  if (name === null) {
    return {
      ...shared,
      state: "not-recorded",
      line: `Nobody has recorded which tax ${rule.name} charges on a sale.`,
      missing: `Ask a tax adviser which tax ${rule.name} charges, and record it on the market's row.`,
    };
  }
  if (!rule.taxRegistered) {
    const rateWords = rate === null ? `${name} at a rate nobody has recorded` : `${name} of ${rate}`;
    return {
      ...shared,
      state: "not-registered",
      line: `Prices carry no ${name}: Knitwright is not registered for ${name} in ${rule.name}. ${rateWords} applies once it is.`,
      missing: threshold === null ? `No ${name} registration threshold is recorded for ${rule.name}.` : `${threshold}.`,
    };
  }
  return {
    ...shared,
    state: "charged",
    line: rate === null ? `${name} is charged in ${rule.name} at a rate nobody has recorded.` : `${name} of ${rate} is charged in ${rule.name}.`,
    missing: rate === null ? `No ${name} rate is recorded for ${rule.name}.` : null,
  };
}
