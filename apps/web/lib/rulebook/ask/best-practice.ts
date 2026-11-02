import { GAP_RULE_ID, type RulebookEntry, type RuleTopic } from "../constants";
import { inScope, type ScopeAsk } from "../scope";
import { rulesInForce, type RuleReader } from "../select";
import { NEWER_DRAFT_LINE } from "../view";
import type { BestPracticeCard, BestPracticeLine } from "./types";

/**
 * The best-practice card shown when a part of the garment is selected (spec F-S5 v2: "a 'Best practice' card
 * when a part is selected"). No model is involved: the card is the rulebook's own "Best practice" column for the
 * rules that cover that part, each with the id it came from, so the "Why?" link beside it opens the same rule.
 *
 * A part is matched to rules by topic and by the words of the rules' own "Applies to" line, which is what the
 * rulebook writes a part's name in ("Neck rib C01", "Cuff K02", "Side seams"). Where no rule covers the part the
 * card says so and carries R-GAP-000: it never fills the space with advice of its own.
 */

/** A part of the garment a founder can select, and how the rulebook names it. Data, not prose in a function. */
export type PartDefinition = Readonly<{
  key: string;
  label: string;
  /** The topics whose rules can be about this part. */
  topics: readonly RuleTopic[];
  /** Words that, in a rule's "Applies to" line or its rule text, mean the rule is about this part. */
  words: readonly string[];
}>;

export const PARTS: readonly PartDefinition[] = [
  { key: "collar", label: "Collar and neck", topics: ["construction", "pattern", "fit"], words: ["collar", "neck", "rib c01", "v-neck", "crew"] },
  { key: "sleeve", label: "Sleeves", topics: ["construction", "pattern", "fit"], words: ["sleeve", "cuff", "bicep", "armhole", "cap"] },
  { key: "body", label: "Body", topics: ["construction", "pattern", "fit"], words: ["body", "front", "back", "side seam", "hem", "chest", "shoulder"] },
  { key: "artwork", label: "Artwork and print", topics: ["print"], words: ["print", "artwork", "seam crossing", "colour", "detail", "fabric", "black"] },
  { key: "names", label: "Names and numbers", topics: ["personalisation"], words: ["name", "number", "method"] },
  { key: "labels", label: "Labels", topics: ["labels"], words: ["label", "finish"] },
];

export const partFor = (key: string): PartDefinition | null => PARTS.find((part) => part.key === key) ?? null;

/** Whether a rule's own words say it is about this part. */
export const aboutPart = (entry: RulebookEntry, part: PartDefinition): boolean => {
  if (entry.topic === null || !part.topics.includes(entry.topic)) return false;
  const text = `${entry.title} ${entry.rule}`.toLowerCase();
  return part.words.some((word) => text.includes(word));
};

const lineOf = (entry: RulebookEntry, newerDraft: boolean): BestPracticeLine => ({
  ruleId: entry.ruleId,
  title: entry.title,
  text: entry.bestPractice,
  newerDraft: newerDraft ? NEWER_DRAFT_LINE : null,
});

/** How many lines a card shows. More than three stops being a card and starts being the rulebook. */
export const MAX_LINES = 3;

/**
 * The card for one part, out of every version of every rule. The version shown is the one this reader may see
 * (owner decision 11) and the rules are the ones that cover the article or method asked about (decision 12).
 */
export function bestPracticeCard(
  entries: readonly RulebookEntry[],
  part: PartDefinition,
  ask: ScopeAsk,
  reader: RuleReader = "member",
): BestPracticeCard {
  const highest = new Map<string, number>();
  for (const entry of entries) highest.set(entry.ruleId, Math.max(highest.get(entry.ruleId) ?? 0, entry.version));
  const lines = rulesInForce(entries, reader)
    .filter((entry) => inScope(entry, ask) && aboutPart(entry, part) && entry.bestPractice.trim() !== "")
    .slice(0, MAX_LINES)
    .map((entry) => lineOf(entry, (highest.get(entry.ruleId) ?? entry.version) > entry.version));
  if (lines.length === 0) {
    return {
      kind: "none",
      part: part.key,
      label: part.label,
      ruleId: GAP_RULE_ID,
      message: `Knitwright's rulebook has no best practice written for ${part.label.toLowerCase()} yet.`,
    };
  }
  return { kind: "lines", part: part.key, label: part.label, lines };
}
