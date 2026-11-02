/**
 * The words, limits and labels of the collection plan and the line plan (plan v5 Z4, spec F-S10;
 * decision 0085). No zod and no database here, so a client component can import it without pulling
 * a schema into the browser (tests/architecture/client-weight).
 *
 * Nothing in this file is a price, a freight rate or a duty rate. Every figure of that kind is a row
 * (`price_tiers`, `country_rules`, `collection_freight_rates`) and is shown with the label of the row
 * it came from.
 */

/** Where a style in the plan has reached (spec F-S10, "Style cards"). */
export const STYLE_STATUSES = ["draft", "sampling", "approved", "ordered"] as const;
export type StyleStatus = (typeof STYLE_STATUSES)[number];

/** What a person reads for each status. */
export const STYLE_STATUS_LABELS: Readonly<Record<StyleStatus, string>> = {
  draft: "Draft",
  sampling: "Sampling",
  approved: "Approved",
  ordered: "Ordered",
};

/** The line plan's columns, in the order spec F-S10 lists them. */
export const LINE_PLAN_COLUMNS = [
  "Style",
  "Group",
  "Status",
  "Colourways",
  "Fabric",
  "Qty",
  "Split (Wholesale / D2C)",
  "Unit cost",
  "Wholesale",
  "RRP",
  "Margin",
] as const;

/** The footer's toggle, word for word from spec F-S10. */
export const SELL_THROUGH = "Assumes full-price sell-through";

/** What the unit cost is made of, said once above the table. */
export const UNIT_COST_IS =
  "Unit cost is the Knitwright price tier for the whole plan's quantity, plus freight and duty to the destination.";

/** The Store is separate (owner decision 1). "Create drop" writes a payload; it reaches no storefront. */
export const DROP_IS_A_PAYLOAD =
  "Create drop writes a drop payload for the Knitwright Store to collect. Quantities are targets, not orders, and nothing is charged here.";

/** Used wherever no rulebook entry explains a check or a row yet (plan v5, "Every rule explains itself"). */
export const GAP_RULE_ID = "R-GAP-000";

/** Said where a colour breakdown is asked for and the plan holds only colourway names. */
export const COLOURS_NOT_READ =
  "A colour list comes from each design's own colours, which the board does not read yet. These are the colourway names on the cards.";

/** One thing the plan found, with the rulebook entry that explains it. */
export type Finding = Readonly<{
  code: string;
  severity: "blocker" | "warning";
  message: string;
  ruleId: string;
}>;

export const blocker = (code: string, message: string, ruleId: string = GAP_RULE_ID): Finding => ({ code, severity: "blocker", message, ruleId });
export const warning = (code: string, message: string, ruleId: string = GAP_RULE_ID): Finding => ({ code, severity: "warning", message, ruleId });

export const pieces = (count: number): string => `${count} ${count === 1 ? "piece" : "pieces"}`;
export const styleWord = (count: number): string => `${count} ${count === 1 ? "style" : "styles"}`;

/** "60% wholesale · 40% D2C", from basis points. */
export const splitText = (wholesaleBp: number): string => `${percent(wholesaleBp)}% wholesale · ${percent(10_000 - wholesaleBp)}% D2C`;

/** Basis points as whole percent, to one decimal place where it is not whole. */
export const percent = (bp: number): string => {
  const value = bp / 100;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
};

/** The styles that sit in no frame are shown together under this heading. */
export const LOOSE_GROUP = "Not in a group";
