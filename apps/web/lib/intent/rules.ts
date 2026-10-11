import { WEARERS, getType, type GarmentSpec, type Wearer } from "@/lib/garment";
import { BREAK, phraseAt, words } from "./mentions";
import type { WireAction } from "./reply-schema";

/**
 * Rules before models (plan cost rule 2, step 12 task 3). A short request made only of
 * words that name choices outright, joined by a few plain words, is answered here without
 * any model call. Anything else, including any refusal, number or unknown word, is left to
 * the model. The answer goes through the same parser and ambiguity rules as a model's reply.
 */

/** Words that may join named choices without changing their meaning. */
const JOINING_WORDS = new Set([
  "a", "an", "the", "it", "its", "this", "that", "one", "my", "our", "please", "pls", "thanks",
  "make", "change", "switch", "swap", "turn", "to", "into", "with", "add", "use", "set", "give", "have",
  "i", "id", "want", "would", "like", "can", "could", "you", "we", "go", "for", "and", "also", "lets", "let",
  "should", "be", "do", "just", "put", "on", "prefer", "need", "some",
]);

/** A longer message is left to the model. */
const MAX_WORDS = 16;

function toAction(target: string): WireAction | null {
  const [kind, first, second] = target.split(":");
  if (kind === "type" && first) return { type: "change-type", typeId: first };
  if (kind === "wearer" && (WEARERS as readonly string[]).includes(first)) return { type: "change-wearer", wearer: first as Wearer };
  if (kind === "choice" && first && second) return { type: "set-option", optionId: first, choiceId: second };
  if (kind === "marks") return { type: "add-names-numbers" };
  return null;
}

/** What an action sets, so two different values for the same thing can be found. */
const slotOf = (action: WireAction): string =>
  action.type === "set-option" ? `option:${action.optionId}` : action.type;

/** Every phrase's targets in the text, or null when any word is not a named choice or a joining word. */
function namedPhrases(utterance: string): (readonly string[])[] | null {
  const tokens = words(utterance);
  if (tokens.length === 0 || tokens.length > MAX_WORDS) return null;
  const phrases: (readonly string[])[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    const phrase = phraseAt(tokens, index);
    if (phrase) {
      phrases.push(phrase.targets);
      index += phrase.length;
    } else if (token === BREAK || JOINING_WORDS.has(token)) {
      index += 1;
    } else {
      return null;
    }
  }
  return phrases;
}

/** True when the target can apply to a design of this type: a choice must be one of its options. */
function fitsType(target: string, typeId: string | undefined): boolean {
  const [kind, optionId] = target.split(":");
  if (kind !== "choice") return true;
  const type = typeId === undefined ? undefined : getType(typeId);
  return type !== undefined && type.options.some((option) => option.id === optionId);
}

/**
 * One target for each phrase, or null. A phrase that names choices in more than one family
 * (such as "long sleeves") is read against the garment type named in the same message, or
 * else the design's own type; if that leaves anything but one, the model decides.
 */
function namedTargets(utterance: string, spec?: GarmentSpec): string[] | null {
  const phrases = namedPhrases(utterance);
  if (!phrases) return null;
  const types = new Set(phrases.flat().filter((target) => target.startsWith("type:")));
  const typeId = types.size === 1 ? [...types][0].split(":")[1] : types.size === 0 ? spec?.typeId : undefined;
  const targets: string[] = [];
  for (const named of phrases) {
    const fitting = named.length === 1 ? named : named.filter((target) => fitsType(target, typeId));
    if (fitting.length !== 1) return null;
    targets.push(fitting[0]);
  }
  return targets;
}

/**
 * The reply a model would give to a request the rules can read on their own, or null.
 * Pure and deterministic.
 */
export function ruleReply(utterance: string, spec?: GarmentSpec): { kind: "changes"; actions: WireAction[] } | null {
  const targets = namedTargets(utterance, spec);
  if (!targets || targets.length === 0) return null;
  const actions: WireAction[] = [];
  const slots = new Map<string, string>();
  for (const target of new Set(targets)) {
    const action = toAction(target);
    if (!action) return null;
    const slot = slotOf(action);
    if (slots.has(slot)) return null;
    slots.set(slot, target);
    actions.push(action);
  }
  return { kind: "changes", actions };
}
