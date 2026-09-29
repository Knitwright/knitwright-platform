import { NEGATORS, VOCABULARY } from "./vocabulary";

export { choiceTarget, typeTarget, wearerTarget } from "./vocabulary";

/** A phrase found in an instruction, and whether the person refused it there. */
export interface Mention {
  readonly target: string;
  readonly negated: boolean;
}

const BREAK = "|";
/** How many words before a phrase are searched for a refusal such as "not" or "instead of". */
const NEGATION_WINDOW = 4;

/** Lower case words, with a break token wherever punctuation ends a clause. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['‘’`]/g, "")
    .replace(/[.,;:!?()\n\r]+/g, ` ${BREAK} `)
    .replace(/[^a-z0-9|]+/g, " ")
    .split(" ")
    .filter((word) => word !== "");
}

interface Phrase {
  readonly words: readonly string[];
  readonly target: string;
}

/** Every phrase, longest first, so the first match at a position is the longest. */
const PHRASES: readonly Phrase[] = VOCABULARY.map((entry) => ({ words: words(entry.phrase), target: entry.target })).sort(
  (a, b) => b.words.length - a.words.length,
);

const matchesAt = (tokens: readonly string[], index: number, phrase: Phrase): boolean =>
  phrase.words.every((word, offset) => tokens[index + offset] === word);

function negatedAt(tokens: readonly string[], index: number): boolean {
  for (let back = index - 1; back >= 0 && back >= index - NEGATION_WINDOW; back -= 1) {
    if (tokens[back] === BREAK) return false;
    if (NEGATORS.includes(tokens[back])) return true;
  }
  return false;
}

/**
 * Finds every garment type, option choice and wearer named in the text, reading left to
 * right and taking the longest phrase at each place. Pure and deterministic.
 */
export function findMentions(text: string): readonly Mention[] {
  const tokens = words(text);
  const found: Mention[] = [];
  let index = 0;
  while (index < tokens.length) {
    const phrase = PHRASES.find((candidate) => matchesAt(tokens, index, candidate));
    if (!phrase) {
      index += 1;
      continue;
    }
    found.push({ target: phrase.target, negated: negatedAt(tokens, index) });
    index += phrase.words.length;
  }
  return found;
}

/** True when the target is named at least once and not refused there. */
export const isStated = (mentions: readonly Mention[], target: string): boolean =>
  mentions.some((mention) => mention.target === target && !mention.negated);
