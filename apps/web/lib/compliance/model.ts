/**
 * The words and rule ids of compliance (plan v5 Z8, F-G2 and F-G3; decision 0089). No zod and no database
 * here, so a client component can import it without pulling a schema into the browser
 * (tests/architecture/client-weight).
 *
 * Nothing in this file is a legal position or a measurement. Every sentence a factory or a wearer reads comes
 * from a row: `country_rules.label_rules` for a market's wording, `care_symbols` for a care symbol,
 * `aql_plans` for an inspection plan. Where no row states it, the finding says so and names the rule.
 */

/** Used wherever no rulebook entry explains a check yet (plan v5, "Every rule explains itself"). */
export const GAP_RULE_ID = "R-GAP-000";

/**
 * The rulebook entries that do explain a check. All four are seeded in `draft` by X2
 * (`20261101020000_rulebook.sql`) from `docs/spec/articles/JSY-SS-01/rulebook.md`.
 */
export const RULE_NECK_LABEL = "R-LAB-001";
export const RULE_CARE_LABEL = "R-LAB-002";
export const RULE_PFAS = "R-LAB-003";
export const RULE_AQL = "R-QC-001";

/** A blocker stops the export or the hand-off. A warning is carried with it and read before cutting. */
export type Severity = "blocker" | "warning";

/** One thing the check found, with the rulebook entry that explains it. */
export type ComplianceFinding = Readonly<{
  code: string;
  severity: Severity;
  /** Plain words the person reads. */
  message: string;
  ruleId: string;
  /** Where in the subject, as a dotted path, so a screen can take the person to it. */
  path: string;
}>;

export const blocker = (code: string, path: string, message: string, ruleId: string = GAP_RULE_ID): ComplianceFinding => ({
  code,
  severity: "blocker",
  message,
  ruleId,
  path,
});

export const warning = (code: string, path: string, message: string, ruleId: string = GAP_RULE_ID): ComplianceFinding => ({
  code,
  severity: "warning",
  message,
  ruleId,
  path,
});

/**
 * The F-G2 checklist, in the order `docs/spec/02-features.md` lists it, with the two guardrails F-G3 and F-G1
 * add at the end. One list, used by the tech pack Review tab, the production package and ordering.
 */
export const CHECKLIST_ITEM_IDS = [
  "needs_input",
  "tbc",
  "poms",
  "bom",
  "labels",
  "colour_gamut",
  "dpi",
  "bleed",
  "moderation",
  "class_b_human_review",
] as const;
export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number];

/** What each item is called on the Review tab and in the package README. */
export const CHECKLIST_TITLES: Readonly<Record<ChecklistItemId, string>> = {
  needs_input: "Every field filled in",
  tbc: "No [TBC] anywhere",
  poms: "Points of measure complete",
  bom: "Bill of materials complete",
  labels: "Labels for every destination market",
  colour_gamut: "Colours inside the print gamut",
  dpi: "Print files at the DPI the rules ask for",
  bleed: "Print files with the bleed the rules ask for",
  moderation: "Moderation clear",
  class_b_human_review: "A person has reviewed this design",
};

/** The three places the one checklist is used. It changes which items apply, never what an item checks. */
export const CHECKLIST_SOURCES = ["techpack", "package", "order"] as const;
export type ChecklistSource = (typeof CHECKLIST_SOURCES)[number];

/** Why an item did not run. A skipped item is never reported as passing. */
export type SkipReason = "not_in_this_source" | "nothing_to_check";

export type ChecklistItemResult = Readonly<{
  id: ChecklistItemId;
  title: string;
  /** `skipped` when the item does not apply here; the reason says why. */
  status: "pass" | "fail" | "warn" | "skipped";
  skipped: SkipReason | null;
  findings: readonly ComplianceFinding[];
}>;

export type ChecklistResult = Readonly<{
  source: ChecklistSource;
  items: readonly ChecklistItemResult[];
  blockers: readonly ComplianceFinding[];
  warnings: readonly ComplianceFinding[];
  /** False while any blocker holds. An export, a package and a hand-off all read this one field. */
  clear: boolean;
}>;

/** The production class of the base article (decision 0066). Null: no base article covers the design yet. */
export type ProductionClass = "A" | "B" | null;

/** The moderation result as X8 reports it, plus `not_built` for a design that was never screened. */
export const MODERATION_STATES = ["clear", "flagged", "blocked", "pending", "not_built"] as const;
export type ModerationState = (typeof MODERATION_STATES)[number];

export const pieces = (count: number): string => `${count} ${count === 1 ? "piece" : "pieces"}`;

/** Joins words the way the rest of the platform does: "a, b and c". */
export const listOf = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
