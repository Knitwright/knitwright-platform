import type { RulebookEntry, RuleTopic } from "./types";

/**
 * Pure choices over rulebook rows. A rule's newest version is the one in force; older versions stay for the record.
 */

/** The newest version of each rule, ordered by rule id. */
export function latestOf(entries: readonly RulebookEntry[]): RulebookEntry[] {
  const newest = new Map<string, RulebookEntry>();
  for (const entry of entries) {
    const held = newest.get(entry.ruleId);
    if (!held || entry.version > held.version) newest.set(entry.ruleId, entry);
  }
  return [...newest.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

export type RuleFilter = Readonly<{ articleCode?: string; topic?: RuleTopic }>;

/** A rule with no article code is shared by every article, so it applies to any article asked for. */
export const appliesTo = (entry: RulebookEntry, articleCode: string): boolean =>
  entry.articleCodes.length === 0 || entry.articleCodes.includes(articleCode);

/** The rules in force for an article and a topic. Either filter may be left out. */
export function selectRules(entries: readonly RulebookEntry[], filter: RuleFilter): RulebookEntry[] {
  return latestOf(entries).filter(
    (entry) =>
      (filter.articleCode === undefined || appliesTo(entry, filter.articleCode)) &&
      (filter.topic === undefined || entry.topic === filter.topic),
  );
}

/** Every version of one rule, newest first. */
export const versionsOf = (entries: readonly RulebookEntry[], ruleId: string): RulebookEntry[] =>
  entries.filter((entry) => entry.ruleId === ruleId).sort((a, b) => b.version - a.version);
