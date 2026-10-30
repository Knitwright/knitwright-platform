import type { GarmentSpec } from "@/lib/garment";
import { previewDiff, type GuardrailRun } from "@/lib/design-diff/preview";
import type { FactoryProfile } from "@/lib/validation";
import type { DesignChecker } from "../ports";
import type { InspirationCard } from "../types";
import { MAX_SUGGESTIONS, RULE_GAP } from "../vocabulary";
import type { ElementReader } from "./elements";
import { diffsFor, type Candidate, type SuggestionDiff } from "./to-diffs";

/**
 * The "Suggest from this" pipeline (spec F-S1, decision 0082): a vision model names the transferable elements, those
 * become at most three design diffs, and **every one of them goes through validation (X4) before it is shown**. A
 * patch the factory profile, the guardrails or a check refuses is never offered: the reason is said plainly instead.
 */

export type Suggestion = Readonly<{
  /** Stable for the same card and the same patch, so a refresh does not change what Apply applies. */
  id: string;
  cardId: string;
  diff: SuggestionDiff;
  /** The one line F-S1 asks for: what it changes and why it fits. */
  line: string;
  /** What a check raised without holding the patch back. Shown under the line. */
  warnings: readonly string[];
  /** The rule this suggestion answers to. The rulebook has no inspiration entry yet, so it is the gap id. */
  ruleId: string;
}>;

export type SuggestResult = Readonly<{
  cardId: string;
  /** The reader that looked at the card: "stub", or the model id. */
  reader: string;
  suggestions: readonly Suggestion[];
  /** Everything the card shows that this base cannot do, and every patch a check refused. */
  notPossible: readonly string[];
}>;

export type SuggestDeps = Readonly<{
  reader: ElementReader;
  profile: FactoryProfile;
  /** Validation (X4). Every patch goes through it before it is shown. */
  check: DesignChecker;
  /** The editor's guardrails, when the caller has panel geometry. Default: none. */
  guardrails?: GuardrailRun;
}>;

const upperFirst = (text: string): string => (text === "" ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`);

/** Why the patch fits, in the words the check can stand behind. Nothing here says a thing is settled. */
const fitsBecause = (profile: FactoryProfile): string => `No blocker was raised against ${profile.name}.`;

const lineFor = (candidate: Candidate, profile: FactoryProfile): string => `${upperFirst(candidate.changes)}. ${fitsBecause(profile)}`;

const idOf = (cardId: string, diff: SuggestionDiff): string => `${cardId}|${JSON.stringify(diff)}`;

/** One candidate, through the preview and then through validation. A refusal comes back as a plain sentence. */
async function offerable(
  spec: GarmentSpec,
  card: InspirationCard,
  candidate: Candidate,
  deps: SuggestDeps,
  signal?: AbortSignal,
): Promise<{ ok: true; suggestion: Suggestion } | { ok: false; sentence: string }> {
  const preview = previewDiff(spec, candidate.diff, deps.profile, deps.guardrails);
  if (!preview.ok) return { ok: false, sentence: `${upperFirst(candidate.changes)} was left out: ${preview.reason}` };
  const result = await deps.check(preview.after, signal);
  if (result.blockers > 0) {
    const first = result.findings.find((finding) => finding.severity === "blocker");
    return { ok: false, sentence: `${upperFirst(candidate.changes)} was left out: ${first?.message ?? "a check refused it."}` };
  }
  return {
    ok: true,
    suggestion: {
      id: idOf(card.id, candidate.diff),
      cardId: card.id,
      diff: candidate.diff,
      line: lineFor(candidate, deps.profile),
      warnings: [...preview.warnings, ...result.findings.filter((finding) => finding.severity !== "blocker").map((finding) => finding.message)],
      ruleId: RULE_GAP,
    },
  };
}

/**
 * Up to three suggestions from one card. The model's answer is read first, then each candidate patch is previewed and
 * checked, in the order the elements gave them, until three stand up. Everything else is said plainly.
 */
export async function suggestFromCard(spec: GarmentSpec, card: InspirationCard, deps: SuggestDeps, signal?: AbortSignal): Promise<SuggestResult> {
  const elements = await deps.reader.read(card, signal);
  const mapped = diffsFor(spec, elements);
  const suggestions: Suggestion[] = [];
  const refused: string[] = [];
  for (const candidate of mapped.candidates) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    const answer = await offerable(spec, card, candidate, deps, signal);
    if (answer.ok) suggestions.push(answer.suggestion);
    else refused.push(answer.sentence);
  }
  return { cardId: card.id, reader: deps.reader.name, suggestions, notPossible: [...mapped.notPossible.map((entry) => entry.sentence), ...refused] };
}
