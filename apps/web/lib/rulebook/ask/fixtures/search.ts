import type { RulebookEntry } from "../../types";
import { inScope } from "../../scope";
import type { Retrieval } from "../retrieve";
import type { AskScope, SearchHit } from "../types";

/**
 * A stand-in for `public.rulebook_search` (migration `20261120020000_rulebook_search.sql`), so the question set
 * and the grader can be run with no database and no model.
 *
 * It is a twin, not the real thing: it splits words the way the Postgres parser does (on anything that is not a
 * letter or a digit), drops the same short words, cuts the same suffixes rather than running Snowball, and ranks
 * by the same field weights. Its job is to put a realistic set of rules in front of the grader. Whether the real
 * SQL finds the same rules is asserted against the real database in `tests/integration/rulebook-search.test.ts`,
 * which runs the same 50 questions through `rulebook_search` itself.
 */

/** Words the English configuration throws away, so they can never count as a match. The common ones. */
const STOP = new Set(
  (
    "a an and are as at be been but by can can't cannot could did do does doesn't don't for from had has have he her his how i if in into is it its just my no not of on or our should so than that the their them then there these they this to too us use used was we were what when where which who why will with you your"
  ).split(" "),
);

const SUFFIXES = ["ational", "ation", "ments", "ment", "ings", "ing", "edly", "ies", "ied", "ed", "es", "s", "ly"];

/** A crude stem, applied to the question and to the rule alike, so a match means the same on both sides. */
export function stem(word: string): string {
  for (const suffix of SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

/** The searchable words of a piece of text: plain words only, stop words out, each stemmed. */
export const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "" && !STOP.has(word))
    .map(stem);

/** The field weights of the migration: applies-to A, rule B, why C, best practice D. */
const WEIGHTS: readonly (readonly [keyof RulebookEntry, number])[] = [
  ["title", 1],
  ["rule", 0.4],
  ["body", 0.2],
  ["bestPractice", 0.1],
];

const fieldWords = (entry: RulebookEntry, field: keyof RulebookEntry): Set<string> =>
  new Set(wordsOf(String(entry[field] ?? "")));

/** Every searchable word of a version, as the generated column holds them. */
export const entryWords = (entry: RulebookEntry): Set<string> =>
  new Set(WEIGHTS.flatMap(([field]) => [...fieldWords(entry, field)]));

/** `ts_rank` over the weighted words: each matched word scores the weight of the field it was found in. */
export function rankOf(entry: RulebookEntry, asked: readonly string[]): number {
  let rank = 0;
  for (const [field, weight] of WEIGHTS) {
    const words = fieldWords(entry, field);
    for (const word of asked) if (words.has(word)) rank += weight;
  }
  return rank;
}

/** The search as the database does it: the rules the question's words reach, in scope, ranked, best first. */
export function searchFixtureRules(
  entries: readonly RulebookEntry[],
  question: string,
  scope: AskScope,
  limit: number,
): SearchHit[] {
  const asked = [...new Set(wordsOf(question))];
  if (asked.length === 0) return [];
  const byRule = new Map<string, SearchHit>();
  for (const entry of entries) {
    if (!inScope(entry, scope)) continue;
    const words = entryWords(entry);
    const matched = asked.filter((word) => words.has(word)).length;
    if (matched === 0) continue;
    const hit = { ruleId: entry.ruleId, rank: rankOf(entry, asked), matched, asked: asked.length };
    const held = byRule.get(entry.ruleId);
    if (!held || hit.rank > held.rank) byRule.set(entry.ruleId, hit);
  }
  return [...byRule.values()].sort((a, b) => b.rank - a.rank || a.ruleId.localeCompare(b.ruleId)).slice(0, limit);
}

/** Retrieval over a fixed set of versions, with no database anywhere. */
export const fixtureRetrieval = (entries: readonly RulebookEntry[]): Retrieval => ({
  search: async (question, scope, limit) => searchFixtureRules(entries, question, scope, limit),
  versions: async (ruleIds) => entries.filter((entry) => ruleIds.includes(entry.ruleId)),
});
