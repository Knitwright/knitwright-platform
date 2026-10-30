import { inScope, type ScopeAsk } from "./scope";
import type { RulebookEntry, RuleTopic } from "./types";

/**
 * Pure choices over rulebook rows: which version a reader is shown, and which rules an article or a method asks
 * for. Owner decision 11: a rule's words are the newest version the factory has CONFIRMED, never a draft, because
 * showing unconfirmed words as the reason for a rule is the settled-sounding claim the wording rules exist to
 * stop. Ops and platform admins see the draft itself, marked draft, because they are the ones writing it.
 */

/** Who is reading. "ops" is the Knitwright team (platform admins); "member" is everybody else signed in. */
export type RuleReader = "member" | "ops";

/** The newest version of each rule whatever its status, ordered by rule id. For the team's own pages. */
export function latestOf(entries: readonly RulebookEntry[]): RulebookEntry[] {
  const newest = new Map<string, RulebookEntry>();
  for (const entry of entries) {
    const held = newest.get(entry.ruleId);
    if (!held || entry.version > held.version) newest.set(entry.ruleId, entry);
  }
  return [...newest.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

/** Every version of one rule, newest first. */
export const versionsOf = (entries: readonly RulebookEntry[], ruleId: string): RulebookEntry[] =>
  entries.filter((entry) => entry.ruleId === ruleId).sort((a, b) => b.version - a.version);

export type InForce = Readonly<{
  /** The version this reader may be shown, or null when there is nothing they may see. */
  shown: RulebookEntry | null;
  /** A newer version the factory has not confirmed: a member is told it is waiting, never shown its words. */
  newerDraft: RulebookEntry | null;
  /** The newest version of all, whatever its status. Null only when the id has no entry at all. */
  newest: RulebookEntry | null;
}>;

/** Which version of one rule this reader gets, out of every version of it. */
export function inForce(versions: readonly RulebookEntry[], reader: RuleReader): InForce {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version);
  const newest = newestFirst[0] ?? null;
  if (reader === "ops") return { shown: newest, newerDraft: null, newest };
  const confirmed = newestFirst.find((version) => version.status === "confirmed") ?? null;
  const newerDraft = confirmed && newest && newest.version > confirmed.version ? newest : null;
  return { shown: confirmed, newerDraft, newest };
}

/** The version in force of every rule, for this reader. A rule with nothing this reader may see is left out. */
export function rulesInForce(entries: readonly RulebookEntry[], reader: RuleReader): RulebookEntry[] {
  const byRule = new Map<string, RulebookEntry[]>();
  for (const entry of entries) byRule.set(entry.ruleId, [...(byRule.get(entry.ruleId) ?? []), entry]);
  return [...byRule.values()]
    .flatMap((versions) => {
      const { shown } = inForce(versions, reader);
      return shown ? [shown] : [];
    })
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

export type RuleFilter = ScopeAsk & Readonly<{ topic?: RuleTopic }>;

/** The rules in force for an article, a method and a topic. Any of the three may be left out. */
export function selectRules(
  entries: readonly RulebookEntry[],
  filter: RuleFilter,
  reader: RuleReader = "member",
): RulebookEntry[] {
  return rulesInForce(entries, reader).filter(
    (entry) => (filter.topic === undefined || entry.topic === filter.topic) && inScope(entry, filter),
  );
}
