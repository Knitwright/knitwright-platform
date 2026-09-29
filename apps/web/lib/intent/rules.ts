import { WEARERS, type Wearer } from "@/lib/garment";
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
  return null;
}

/** What an action sets, so two different values for the same thing can be found. */
const slotOf = (action: WireAction): string =>
  action.type === "set-option" ? `option:${action.optionId}` : action.type;

/** The targets named in the text, or null when any word is not a named choice or a joining word. */
function namedTargets(utterance: string): string[] | null {
  const tokens = words(utterance);
  if (tokens.length === 0 || tokens.length > MAX_WORDS) return null;
  const targets: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    const phrase = phraseAt(tokens, index);
    if (phrase) {
      targets.push(phrase.target);
      index += phrase.length;
    } else if (token === BREAK || JOINING_WORDS.has(token)) {
      index += 1;
    } else {
      return null;
    }
  }
  return targets;
}

/**
 * The reply a model would give to a request the rules can read on their own, or null.
 * Pure and deterministic.
 */
export function ruleReply(utterance: string): { kind: "changes"; actions: WireAction[] } | null {
  const targets = namedTargets(utterance);
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
