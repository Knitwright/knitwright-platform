/**
 * The rulebook's words that the browser may need too: ids, topics, sources, statuses and the entry shape. No zod
 * here, so client components can import it without the schema library (tests/architecture/client-weight.test.ts).
 */

/** `R-<TOPIC>-<NNN>`, as in `docs/spec/articles/JSY-SS-01/rulebook.md`, e.g. `R-SUB-004`. */
export const RULE_ID = /^R-[A-Z]{2,8}-\d{3}$/;

/** The rule that stands in for a check with no entry yet. Its text is the plan's, not a manufacturing fact. */
export const GAP_RULE_ID = "R-GAP-000";

export const TOPICS = [
  "construction",
  "fabric",
  "print",
  "fit",
  "grading",
  "labels",
  "qc",
  "cost",
  "pattern",
  "personalisation",
] as const;
export type RuleTopic = (typeof TOPICS)[number];

export const SOURCES = ["factory", "pattern_master", "standard", "knitwright"] as const;
export type RuleSource = (typeof SOURCES)[number];

export const STATUSES = ["draft", "confirmed"] as const;
export type RuleStatus = (typeof STATUSES)[number];

/** One version of one rule, as the app uses it. */
export type RulebookEntry = Readonly<{
  id: string;
  ruleId: string;
  version: number;
  topic: RuleTopic | null;
  /** Empty means the rule is shared by every article (the R-SUB, R-LAB, R-QC and R-COST rules). */
  articleCodes: readonly string[];
  /** The rulebook's "Applies to" column. */
  title: string;
  /** The rulebook's "Rule" column: what the system enforces. */
  rule: string;
  /** The rulebook's "Why" column, in plain words. */
  body: string;
  bestPractice: string;
  source: RuleSource;
  /** The rulebook's "Source" column, word for word. */
  sourceNote: string;
  status: RuleStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
}>;
