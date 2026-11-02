/**
 * The settings and words of the instant quote (spec F-T5, plan v5 Z6, decision 0105).
 *
 * Every figure is a row here rather than a literal in the document: the validity window, the number
 * format and what a quote says is included. Nothing in this file is a price, a date or a tax rate —
 * those come from X6's price tiers, X6's cut-off and `country_rules`, every time.
 */

/** Used where the rulebook has no entry for a rule a quote applies. Listed on the pull request. */
export const GAP_RULE_ID = "R-GAP-000";

export const QUOTE_SETTINGS = {
  /** "validity of 30 days" (spec F-T5). */
  validityDays: 30,
  /** What a quote number starts with. Knitwright's own, so a club can say "my KWQ number". */
  numberPrefix: "KWQ",
  /** How long the reference part of a number is. Long enough that two baskets do not share one. */
  referenceLength: 6,
  /** The budget the whole document is measured against: "the PDF is generated in under 5 seconds". */
  budgetMs: 5_000,
  /** The longest a club name may be on a quote: the design name's own limit in Z5's save. */
  clubNameMax: 80,
} as const;

/** Says whose figures these are, wherever one is shown. */
export const SETTINGS_LABEL = "Knitwright default, taken from the specification and not agreed with a factory";

/**
 * The rulebook entries a quote cites, read from `docs/spec/articles/JSY-SS-01/rulebook.md`.
 * A line with no entry uses `GAP_RULE_ID` and is listed on the pull request.
 */
export const RULES = {
  /** Full sublimation costs the same whether the design is plain or busy. */
  patternCost: "R-COST-001",
  /** Options add sewing time; their prices come from the factory profile. */
  optionCost: "R-COST-002",
  /** Names and numbers are printed in the same pass; the per-piece price is a placeholder. */
  personalisationCost: "R-COST-003",
  /** Names and numbers are printed in the same sublimation pass. */
  personalisationMethod: "R-PER-004",
} as const;

/** The title of the document, and the words under it. Never "final" and never "approved". */
export const QUOTE_TITLE = "Quote";
export const QUOTE_LEAD =
  "This is what Knitwright can offer today, from the factory data on file. Every price below comes from the factory's own price tiers; where a figure is a Knitwright placeholder it says so beside it.";

/** Said once on the document: Knitwright shows the price and the Store takes the order. */
export const NO_PAYMENT_HERE =
  "Knitwright does not take money for this quote. When you are ready, the Knitwright Store takes the order, the money and the delivery.";

/** What a quote says about itself where something could not be worked out. Never a blank. */
export const NOT_KNOWN = "Not known yet";
