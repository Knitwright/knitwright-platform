import { appTier } from "@/lib/factory/fixtures/rows";
import type { CountryRule } from "@/lib/factory/schemas";
import type { DeliveryLine } from "@/lib/make/delivery";
import { buildQuote, type Quote, type QuoteInput } from "../quote";

/**
 * Fixtures for the quote's tests. The ladders are X6's own test rows, whose every label says
 * "test", and the country rule is the shape `country_rules` stores. Nothing here is a real price.
 */

/** The jersey's test ladder: 10-19 at £29.00, 20-49 at £25.00, 50+ at £22.00, and no AUD price. */
export const JERSEY_LADDER = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

/** The shorts' test ladder: one open tier at £12.00. */
export const SHORTS_LADDER = [appTier(10, null, 1200)];

export const TEST_LABEL = "Test row, not a factory's own price";

export const countryRule = (overrides: Partial<CountryRule> = {}): CountryRule => ({
  id: "11111111-1111-4111-8111-111111111111",
  country: "GB",
  name: "United Kingdom",
  currency: "GBP",
  vatRateBp: 2000,
  lowValueThresholdMinor: 13_500,
  dutyByHs: {},
  preferenceScheme: "DCTS",
  labelRules: {},
  freightDays: 4,
  sellingEnabled: true,
  ruleId: "R-GAP-000",
  label: "Placeholder, to confirm with a customs adviser",
  ...overrides,
});

/** A delivery line of the shape Y7's own `deliveryLine` gives when nothing is set. */
export const NO_DATE_YET: DeliveryLine = {
  status: "not-set",
  promisedOn: null,
  text: "No delivery date yet. Not set: the days for QC and the freight days.",
  note: "The cut-off and the days for QC are Knitwright placeholders, not a factory's terms.",
};

/** A delivery line with a date, for the one case where every part of the sum is on file. */
export const WITH_DATE: DeliveryLine = {
  status: "set",
  promisedOn: "2026-12-01",
  text: "Delivery 2026-12-01, from the factory data on file: the next cut-off, the factory's lead time, the days for QC and the freight days.",
  note: "",
};

export const ISSUED_AT = new Date("2026-11-02T09:00:00.000Z");

export const quoteInput = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  issuedAt: ISSUED_AT,
  clubName: "Sialkot Rovers",
  brandName: "Test brand",
  sportId: "football",
  sportLabel: "Football",
  currency: "GBP",
  lines: [
    { articleCode: "JSY-SS-01", label: "Shirt", qty: 20, ladder: JERSEY_LADDER },
    { articleCode: "SHO-TR-01", label: "Shorts", qty: 20, ladder: SHORTS_LADDER },
  ],
  unpriced: [{ label: "Socks", reason: "No base article covers this part yet, so the factory has no price for it. It is not in the total." }],
  inclusions: { crest: true, sponsors: 1, namesNumbers: true },
  delivery: NO_DATE_YET,
  vat: {
    country: "GB",
    countryName: "United Kingdom",
    rate: "20%",
    text: "VAT or GST in United Kingdom is 20% in Knitwright's market rules.",
    label: "Placeholder, to confirm with a customs adviser",
    ruleId: "R-GAP-000",
  },
  linkBack: "/teamwear?sport=football&part=shirt&market=GBP",
  factoryLabel: `Sialkot partner (placeholder) · Sialkot · ${TEST_LABEL}`,
  ...overrides,
});

export const testQuote = (overrides: Partial<QuoteInput> = {}): Quote => buildQuote(quoteInput(overrides));
