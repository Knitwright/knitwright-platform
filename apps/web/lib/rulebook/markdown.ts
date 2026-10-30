import { RULE_ID, type RuleSource, type RuleTopic } from "./types";

/**
 * Reads a rulebook file in the shape of `docs/spec/articles/JSY-SS-01/rulebook.md`: one table row per rule with the
 * columns ID, Applies to, Rule, Why, Best practice, Source, Status. The cells are kept word for word; nothing is
 * rewritten. The migration's seed was made from this reading, and a test compares the two.
 */

export type SeedRule = Readonly<{
  ruleId: string;
  topic: RuleTopic;
  articleCodes: readonly string[];
  title: string;
  rule: string;
  body: string;
  bestPractice: string;
  source: RuleSource;
  sourceNote: string;
  status: "draft";
}>;

/** The topic each rule family belongs to. A family not listed here is refused, so no rule is filed by guesswork. */
export const TOPIC_BY_FAMILY: Readonly<Record<string, RuleTopic>> = {
  PAT: "pattern",
  FIT: "fit",
  CON: "construction",
  SUB: "print",
  PER: "personalisation",
  LAB: "labels",
  QC: "qc",
  COST: "cost",
};

/** The families the rulebook calls "shared by every sublimated article". Their rules carry no article code. */
export const SHARED_FAMILIES: ReadonlySet<string> = new Set(["SUB", "LAB", "QC", "COST"]);

export const familyOf = (ruleId: string): string => ruleId.split("-")[1] ?? "";

/**
 * Which source a "Source" note named when the rulebook was first seeded. Owner decision 13 reads some of those
 * notes differently; `sources.ts` holds the reading in force, and this one stays so the first migration can still
 * be checked against the rulebook. The note itself is kept as written; this is only the filter.
 * "Knitwright draft..." is Knitwright; "Factory to confirm...", a factory or supplier price list is the factory;
 * everything else (industry, process, regulation and standards practice) is a standard.
 */
export function sourceFromNote(note: string): RuleSource {
  if (/^knitwright\b/i.test(note)) return "knitwright";
  if (/^factory\b/i.test(note) || /price list/i.test(note)) return "factory";
  return "standard";
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

/** Every rule row in the file, in file order. Throws on a row with the wrong number of cells or an unknown family. */
export function parseRulebookMarkdown(markdown: string, articleCode: string): SeedRule[] {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*R-/.test(line))
    .map((line) => {
      const row = cells(line);
      const [ruleId = "", title = "", rule = "", body = "", bestPractice = "", sourceNote = ""] = row;
      if (row.length !== 7 || !RULE_ID.test(ruleId)) throw new Error(`Not a rulebook row: ${line}`);
      const family = familyOf(ruleId);
      const topic = TOPIC_BY_FAMILY[family];
      if (!topic) throw new Error(`No topic for the rule family ${family}.`);
      return {
        ruleId,
        topic,
        articleCodes: SHARED_FAMILIES.has(family) ? [] : [articleCode],
        title,
        rule,
        body,
        bestPractice,
        source: sourceFromNote(sourceNote),
        sourceNote,
        status: "draft" as const,
      };
    });
}
