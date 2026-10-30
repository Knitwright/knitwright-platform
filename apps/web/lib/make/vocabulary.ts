/**
 * The words, limits and labels of the make flow (plan v5 Y7, F-S7; decision 0080). No zod and no database here, so a
 * client component can import it without pulling a schema into the browser (tests/architecture/client-weight).
 *
 * Nothing in this file is a factory's word. Every figure that would be one is "not set" until a factory agrees it, and
 * every price and date shown beside it carries the label of the row it came from.
 */

/** Where a golden sample is. Stored values, never shown as a sentence: the screens say "signed off". */
export const GOLDEN_SAMPLE_STATES = ["draft", "approved", "changes_requested"] as const;
export type GoldenSampleState = (typeof GOLDEN_SAMPLE_STATES)[number];

/** What a person reads for each state. The founder's sign-off is a recorded act, so it is named as one. */
export const GOLDEN_SAMPLE_STATE_LABELS: Readonly<Record<GoldenSampleState, string>> = {
  draft: "Being judged",
  approved: "Signed off by the founder",
  changes_requested: "Changes asked for",
};

/** The founder rates fit and colour on this scale. Both are needed to sign a golden sample off. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** F-S7: one piece per size requested, at most three sizes. */
export const SAMPLE_MAX_SIZES = 3;
export const SAMPLE_PIECES_PER_SIZE = 1;

/** F-S7: Class A is any quantity from one piece, in the weekly batch; Class B is 50 to 300 per style. */
export const CLASS_A_MIN_PIECES = 1;
export const CLASS_B_MIN_PIECES = 50;
export const CLASS_B_MAX_PIECES = 300;

/** The quantities the product-created page quotes (F-S7: "price at 1/50/100"). */
export const QUOTE_QUANTITIES: readonly number[] = [1, 50, 100];

/** Used wherever no rulebook entry explains a check yet (plan v5, "Every rule explains itself"). */
export const GAP_RULE_ID = "R-GAP-000";

/** The Store is separate (owner decision 1). Publishing is not built here, and this sentence says who does it. */
export const STORE_HANDS_IT = "Handled by the Knitwright Store";

/** One thing the make flow found, with the rulebook entry that explains it. */
export type MakeFinding = Readonly<{
  code: string;
  severity: "blocker" | "warning";
  message: string;
  ruleId: string;
}>;

export const blocker = (code: string, message: string, ruleId: string = GAP_RULE_ID): MakeFinding => ({ code, severity: "blocker", message, ruleId });
export const warning = (code: string, message: string, ruleId: string = GAP_RULE_ID): MakeFinding => ({ code, severity: "warning", message, ruleId });

export const pieces = (count: number): string => `${count} ${count === 1 ? "piece" : "pieces"}`;
