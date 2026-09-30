import { NEGATORS, VOCABULARY } from "./vocabulary";

export { choiceTarget, typeTarget, wearerTarget } from "./vocabulary";

/** A phrase found in an instruction, and whether the person refused it there. */
export interface Mention {
  readonly target: string;
  readonly negated: boolean;
}

export const BREAK = "|";
/** How many words before a phrase are searched for a refusal such as "not" or "instead of". */
const NEGATION_WINDOW = 4;

/** Lower case words, with a break token wherever punctuation ends a clause. */
export function words(text: string): string[] {
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
  /** Every target this phrase names. A phrase may name a choice in more than one family. */
  readonly targets: readonly string[];
}

function groupPhrases(): Phrase[] {
  const byKey = new Map<string, { words: string[]; targets: string[] }>();
  for (const entry of VOCABULARY) {
    const split = words(entry.phrase);
    const key = split.join(" ");
    const found = byKey.get(key) ?? { words: split, targets: [] };
    if (!found.targets.includes(entry.target)) found.targets.push(entry.target);
    byKey.set(key, found);
  }
  return [...byKey.values()];
}

/** Every phrase, longest first, so the first match at a position is the longest. */
const PHRASES: readonly Phrase[] = groupPhrases().sort((a, b) => b.words.length - a.words.length);

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
 * The longest phrase that starts at `index`, every target it names, and how many words it
 * takes, or null. A phrase may name a choice in more than one family.
 */
export function phraseAt(
  tokens: readonly string[],
  index: number,
): { readonly targets: readonly string[]; readonly length: number } | null {
  const phrase = PHRASES.find((candidate) => matchesAt(tokens, index, candidate));
  return phrase ? { targets: phrase.targets, length: phrase.words.length } : null;
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
    const negated = negatedAt(tokens, index);
    for (const target of phrase.targets) found.push({ target, negated });
    index += phrase.words.length;
  }
  return found;
}

/** True when the target is named at least once and not refused there. */
export const isStated = (mentions: readonly Mention[], target: string): boolean =>
  mentions.some((mention) => mention.target === target && !mention.negated);
