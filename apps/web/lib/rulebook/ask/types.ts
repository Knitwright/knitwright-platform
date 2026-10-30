import type { RulebookEntry } from "../constants";

/**
 * Ask and best practice (spec F-S5 v2, plan v5 Z2, decision 0083). The shapes the Ask box, the best-practice
 * card and the tech-pack drafting work in.
 *
 * The one rule behind all of them: nothing here ever says anything the rulebook does not. An answer restates a
 * rule that was retrieved and names its id; a sentence that names no id is a defect the grader catches; where no
 * rule covers the question the answer says so and the gap is written down for the team.
 */

/** What the question is about: the design's base article and the way it is made. Both may be missing. */
export type AskScope = Readonly<{ articleCode?: string; method?: string }>;

/** One rule the search matched, as `rulebook_search` scores it. */
export type SearchHit = Readonly<{
  ruleId: string;
  /** `ts_rank` over the weighted words, highest first. */
  rank: number;
  /** How many of the question's searchable words this rule holds, out of `asked`. */
  matched: number;
  asked: number;
}>;

/**
 * One rule the answer may draw on: the version this reader may be shown, and nothing else. A rule whose words
 * no factory has signed off never becomes one of these for a member (owner decision 11).
 */
export type RetrievedRule = Readonly<{
  ruleId: string;
  version: number;
  title: string;
  rule: string;
  body: string;
  bestPractice: string;
  /** How far the rule reaches, in plain words (owner decision 12). */
  scope: string;
  /** Owner decision 11's line, where a newer draft is waiting. Null otherwise. */
  newerDraft: string | null;
  hit: SearchHit;
}>;

/** One sentence of an answer and the rule ids it cites. A sentence with no id is a defect. */
export type AskSentence = Readonly<{ text: string; ruleIds: readonly string[] }>;

/** Why an answer was turned down. Each one names what the grader found. */
export type AskDefect = Readonly<{
  kind: "uncited_sentence" | "id_not_retrieved" | "citation_mismatch" | "measurement_not_in_the_rule" | "no_sentences";
  /** The sentence it was found in, as the model wrote it. */
  sentence: string;
  detail: string;
}>;

export type AskGrade = Readonly<{
  /** True when every sentence cites a retrieved rule and states no measurement those rules do not hold. */
  ok: boolean;
  defects: readonly AskDefect[];
  /** The ids the answer cited, in the order they first appear. */
  cited: readonly string[];
}>;

/**
 * What the Ask box shows.
 *
 *  * `answer`: the model's words, every sentence citing a rule the search retrieved;
 *  * `not_covered`: no rule covers the question. The gap is written down for the team;
 *  * `ungrounded`: the model wrote something the rulebook does not hold, so its words are dropped and the rules
 *    the search found are shown in their own words instead;
 *  * `unavailable`: no model is switched on, so the box says so and offers the rules the search found.
 */
export type AskResult =
  | Readonly<{ kind: "answer"; question: string; sentences: readonly AskSentence[]; rules: readonly RetrievedRule[]; grade: AskGrade }>
  | Readonly<{ kind: "not_covered"; question: string; ruleId: string; message: string }>
  // The model's own words never reach the browser here: only WHICH of the grader's readings turned them down,
  // because showing an ungrounded sentence to explain that it is ungrounded would still be showing it.
  | Readonly<{ kind: "ungrounded"; question: string; message: string; rules: readonly RetrievedRule[]; defects: readonly AskDefect["kind"][] }>
  | Readonly<{ kind: "unavailable"; question: string; message: string; rules: readonly RetrievedRule[] }>;

/** One line of the best-practice card: the rulebook's own best-practice words, with the rule they belong to. */
export type BestPracticeLine = Readonly<{ ruleId: string; title: string; text: string; newerDraft: string | null }>;

/** The card shown when a part is selected. With nothing to show it carries R-GAP-000 and says so. */
export type BestPracticeCard =
  | Readonly<{ kind: "lines"; part: string; label: string; lines: readonly BestPracticeLine[] }>
  | Readonly<{ kind: "none"; part: string; label: string; ruleId: string; message: string }>;

/** Where a tech-pack field's words came from. Z2 drafts only from the base article's own construction table. */
export type FieldProvenance = "from_base";

/** One drafted tech-pack overview field: a sentence made of the construction row's own values. */
export type TechpackField = Readonly<{
  key: string;
  label: string;
  text: string;
  ruleId: string;
  provenance: FieldProvenance;
}>;

/** A rulebook entry as the ask code needs it: every version of every rule the search found. */
export type Versions = Readonly<Record<string, readonly RulebookEntry[]>>;
