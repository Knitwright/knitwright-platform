import { latestOf, versionsOf } from "./select";
import { TOPICS, type RuleTopic, type RulebookEntry } from "./types";
import { statusLabel } from "./view";

/** What the rulebook admin page lists: each rule's newest version, its earlier versions and who confirmed it. */

export type AdminRule = Readonly<{
  entry: RulebookEntry;
  status: string;
  confirmedByName: string | null;
  earlier: readonly Readonly<{ version: number; status: string; rule: string; body: string }>[];
}>;

export type AdminGroup = Readonly<{ topic: RuleTopic | "other"; title: string; rules: readonly AdminRule[] }>;

const TOPIC_TITLES: Readonly<Record<RuleTopic | "other", string>> = {
  pattern: "Pattern",
  fit: "Fit",
  grading: "Grading",
  construction: "Construction",
  fabric: "Fabric",
  print: "Sublimation and print",
  personalisation: "Personalisation",
  labels: "Labels and compliance",
  qc: "Quality control",
  cost: "Cost drivers",
  other: "Not about one topic",
};

const ORDER: readonly (RuleTopic | "other")[] = [...TOPICS, "other"];

/** Groups by topic in a fixed order; a topic with no rule is left out. Names are sign-in addresses, when known. */
export function adminGroups(entries: readonly RulebookEntry[], names: Readonly<Record<string, string>>): AdminGroup[] {
  const rules = latestOf(entries).map(
    (entry): AdminRule => ({
      entry,
      status: statusLabel(entry),
      confirmedByName: entry.confirmedBy ? (names[entry.confirmedBy] ?? null) : null,
      earlier: versionsOf(entries, entry.ruleId)
        .slice(1)
        .map((old) => ({ version: old.version, status: statusLabel(old), rule: old.rule, body: old.body })),
    }),
  );
  return ORDER.map((topic) => ({
    topic,
    title: TOPIC_TITLES[topic],
    rules: rules.filter((rule) => (rule.entry.topic ?? "other") === topic),
  })).filter((group) => group.rules.length > 0);
}

/** A date and time as "YYYY-MM-DD HH:MM UTC", the same for every reader. */
export const stamp = (iso: string): string => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
