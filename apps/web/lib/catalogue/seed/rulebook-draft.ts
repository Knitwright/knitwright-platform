import { RULE_ID } from "../vocabulary";

/**
 * Reads the rulebook of a base article (`docs/spec/articles/<CODE>/rulebook.md`) as rows, and says what is wrong
 * with them. The shape is the worked article's: one table row per rule with the columns ID, Applies to, Rule, Why,
 * Best practice, Source, Status, so one reading serves every article's file.
 *
 * This is the gate on the briefs of plan v5 workstream Z9 (decision 0090): an entry of a drafted article must carry
 * a source, must still be `draft`, and must cite a file of the build pack or the plan rather than stating a
 * manufacturing fact nobody published.
 */

export type DraftRule = Readonly<{
  ruleId: string;
  appliesTo: string;
  rule: string;
  why: string;
  bestPractice: string;
  source: string;
  status: string;
  cells: number;
}>;

const cellsOf = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

/** Every rule row of the file, in file order. A row with the wrong number of cells is kept, so it can be reported. */
export function parseDraftRulebook(markdown: string): readonly DraftRule[] {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*R-/.test(line))
    .map((line) => {
      const cells = cellsOf(line);
      const [ruleId = "", appliesTo = "", rule = "", why = "", bestPractice = "", source = "", status = ""] = cells;
      return { ruleId, appliesTo, rule, why, bestPractice, source, status, cells: cells.length };
    });
}

export const ruleIdsOf = (markdown: string): readonly string[] => parseDraftRulebook(markdown).map((rule) => rule.ruleId);

/** What is wrong with these rows. Empty means every row is readable, complete and still a draft. */
export function draftRuleProblems(rules: readonly DraftRule[]): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.cells !== 7) problems.push(`${rule.ruleId}: ${rule.cells} cells, not 7.`);
    if (!RULE_ID.test(rule.ruleId)) problems.push(`${rule.ruleId}: not a rule id.`);
    if (seen.has(rule.ruleId)) problems.push(`${rule.ruleId}: appears twice in the same file.`);
    seen.add(rule.ruleId);
    const blank = (["appliesTo", "rule", "why", "bestPractice", "source"] as const).filter((key) => rule[key] === "");
    for (const key of blank) problems.push(`${rule.ruleId}: the ${key} cell is empty.`);
    if (rule.status !== "draft") problems.push(`${rule.ruleId}: status ${rule.status}, not draft.`);
  }
  return problems;
}

/** A source that names a file of the build pack, the plan or a decision record, which is what a citation is here. */
const CITATION = /docs\/spec\/|plans\/platform-v5\.md|docs\/decisions\//;

/** The rows whose source cites nothing. A rule of a drafted article may not rest on an unnamed practice. */
export const uncitedRules = (rules: readonly DraftRule[]): readonly string[] =>
  rules.filter((rule) => !CITATION.test(rule.source)).map((rule) => rule.ruleId);
