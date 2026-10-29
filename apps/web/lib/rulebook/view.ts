import { GAP_RULE_ID, type RuleSource, type RulebookEntry } from "./constants";

/**
 * What a "Why?" popover shows. A known rule shows its words as written in the rulebook, where they came from and
 * whether the factory has confirmed them. An unknown id shows the gap text and nothing else: no fact is made up.
 */

/** The words of R-GAP-000, set by plan v5 X2. */
export const GAP_TEXT = "No rule written yet; the team has been told";

export const DRAFT_LABEL = "Draft, not yet confirmed by the factory";

export const SOURCE_LABELS: Readonly<Record<RuleSource, string>> = {
  factory: "The factory",
  pattern_master: "The pattern master",
  standard: "Industry standard or practice",
  knitwright: "Knitwright",
};

export type WhyView =
  | Readonly<{
      kind: "rule";
      ruleId: string;
      version: number;
      title: string;
      rule: string;
      body: string;
      bestPractice: string;
      source: string;
      status: string;
      draft: boolean;
    }>
  | Readonly<{ kind: "gap"; ruleId: string; text: string }>;

/** A date as YYYY-MM-DD, the same for every reader wherever they are. */
const day = (iso: string): string => iso.slice(0, 10);

export const statusLabel = (entry: Pick<RulebookEntry, "status" | "confirmedAt">): string =>
  entry.status === "confirmed" && entry.confirmedAt ? `Confirmed by the factory on ${day(entry.confirmedAt)}` : DRAFT_LABEL;

/** The popover for an entry, or the gap text when there is none (or the entry is R-GAP-000 itself). */
export function whyView(ruleId: string, entry: RulebookEntry | null): WhyView {
  if (!entry || entry.ruleId === GAP_RULE_ID) return { kind: "gap", ruleId, text: entry?.body || GAP_TEXT };
  return {
    kind: "rule",
    ruleId: entry.ruleId,
    version: entry.version,
    title: entry.title,
    rule: entry.rule,
    body: entry.body,
    bestPractice: entry.bestPractice,
    source: entry.sourceNote ? `${SOURCE_LABELS[entry.source]}: ${entry.sourceNote}` : SOURCE_LABELS[entry.source],
    status: statusLabel(entry),
    draft: entry.status === "draft",
  };
}
