import { GAP_RULE_ID, type RuleSource, type RulebookEntry } from "./constants";
import { scopeLabel } from "./scope";
import type { InForce } from "./select";

/**
 * What a "Why?" popover shows. A known rule shows its words as written in the rulebook, how far it reaches, where
 * it came from and who reviewed it. Owner decision 11: those words are the newest version the factory has
 * confirmed. Where a newer draft is waiting, the popover says so without showing it; where nothing is confirmed at
 * all, it says that too. An unknown id shows the gap text and nothing else: no fact is made up for anyone.
 */

/** The words of R-GAP-000, set by plan v5 X2. */
export const GAP_TEXT = "No rule written yet; the team has been told";

export const DRAFT_LABEL = "Draft, not yet confirmed by the factory";

/** Owner decision 11, word for word. Shown with the confirmed words, never with the draft's. */
export const NEWER_DRAFT_LINE = "a newer draft is waiting for the factory to confirm it";

/** Owner decision 11: a rule whose words no factory has signed off is not read out as the reason for anything. */
export const NOTHING_CONFIRMED_TEXT = `${DRAFT_LABEL}, so its words are not shown here`;

export const SOURCE_LABELS: Readonly<Record<RuleSource, string>> = {
  factory: "The factory",
  supplier: "A supplier",
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
      scope: string;
      source: string;
      status: string;
      draft: boolean;
      /** Owner decision 11's line, or null when the shown version is the newest one. */
      newerDraft: string | null;
    }>
  | Readonly<{ kind: "gap"; ruleId: string; text: string }>
  | Readonly<{ kind: "unconfirmed"; ruleId: string; text: string }>;

/** A date as YYYY-MM-DD, the same for every reader wherever they are. */
const day = (iso: string): string => iso.slice(0, 10);

type Signed = Pick<RulebookEntry, "status" | "confirmedAt" | "confirmedName" | "confirmedRole">;

/**
 * Owner decision 14: a confirmation names the factory person who reviewed the rule, their role and the date, so it
 * can be audited. A version with nobody against it reads as a draft, whatever its status column says.
 */
export const statusLabel = (entry: Signed): string =>
  entry.status === "confirmed" && entry.confirmedAt && entry.confirmedName && entry.confirmedRole
    ? `Reviewed by ${entry.confirmedName}, ${entry.confirmedRole}, on ${day(entry.confirmedAt)}`
    : DRAFT_LABEL;

const sourceLine = (entry: RulebookEntry): string =>
  entry.sourceNote ? `${SOURCE_LABELS[entry.source]}: ${entry.sourceNote}` : SOURCE_LABELS[entry.source];

/** The popover for one rule, out of the versions the person reading may see (`inForce`). */
export function whyView(ruleId: string, resolved: InForce): WhyView {
  const { shown, newerDraft, newest } = resolved;
  if (!newest || newest.ruleId === GAP_RULE_ID) return { kind: "gap", ruleId, text: newest?.body || GAP_TEXT };
  if (!shown) return { kind: "unconfirmed", ruleId, text: NOTHING_CONFIRMED_TEXT };
  return {
    kind: "rule",
    ruleId: shown.ruleId,
    version: shown.version,
    title: shown.title,
    rule: shown.rule,
    body: shown.body,
    bestPractice: shown.bestPractice,
    scope: scopeLabel(shown),
    source: sourceLine(shown),
    status: statusLabel(shown),
    draft: shown.status === "draft",
    newerDraft: newerDraft ? NEWER_DRAFT_LINE : null,
  };
}
