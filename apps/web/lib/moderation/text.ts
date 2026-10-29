import { findPhrase, wordsOf } from "./normalise";
import { reason, verdictOf, type Mark, type Reason, type Verdict } from "./types";
import { OFFENSIVE_WORDS, type OffensiveWord } from "./words";

/**
 * Text screening (F-G1): offensive words, third-party brand names from the registry, and the product-title rules ("dupe",
 * "inspired by <brand>"). Pure: the registry is passed in.
 *
 * Where the words appear changes what a brand name does. In a product title it blocks (spec decision 7: titles containing a
 * third-party brand are blocked). In a name, a slogan, a file label or a prompt it only flags, because "Arsenal" can be a
 * player's nickname or a club's own licensed name, and a person should decide.
 */
export const TEXT_CONTEXTS = ["title", "name", "slogan", "label", "prompt"] as const;
export type TextContext = (typeof TEXT_CONTEXTS)[number];

const DUPE_WORDS = new Set(["dupe", "dupes"]);
const INSPIRED_BY = ["inspired", "by"] as const;

const matchesWord = (entry: OffensiveWord, word: string): boolean =>
  word === entry.word || word === `${entry.word}s` || word === `${entry.word}es` || (entry.prefix === true && word.startsWith(entry.word));

function offensive(words: readonly string[]): Reason[] {
  const found: Reason[] = [];
  for (const entry of OFFENSIVE_WORDS) {
    if (!words.some((word) => matchesWord(entry, word))) continue;
    found.push(
      entry.severity === "block"
        ? reason("profanity", "block", "This contains a word we do not print. Choose other words.", entry.word)
        : reason("profanity", "flag", "This contains a word that can be offensive. A person will look at it before it is made.", entry.word),
    );
  }
  return found;
}

type MarkHit = Readonly<{ mark: Mark; at: number; length: number }>;

function markHits(words: readonly string[], marks: readonly Mark[]): MarkHit[] {
  return marks.flatMap((mark) => {
    if (!mark.markText) return [];
    const phrase = wordsOf(mark.markText);
    const at = findPhrase(words, phrase);
    return at < 0 ? [] : [{ mark, at, length: phrase.length }];
  });
}

function brandTerms(hits: readonly MarkHit[], context: TextContext): Reason[] {
  return hits.map(({ mark }) =>
    context === "title"
      ? reason("brand_term", "block", `Product titles cannot name another brand ("${mark.markText}").`, mark.markText ?? undefined)
      : reason("brand_term", "flag", `"${mark.markText}" is a registered name. A person will check you may use it before it is made.`, mark.markText ?? undefined),
  );
}

function titleRules(words: readonly string[], hits: readonly MarkHit[]): Reason[] {
  const found: Reason[] = [];
  const dupe = words.find((word) => DUPE_WORDS.has(word));
  if (dupe) found.push(reason("dupe_title", "block", 'Product titles cannot call a product a "dupe".', dupe));
  const inspired = findPhrase(words, INSPIRED_BY);
  if (inspired >= 0) {
    const next = inspired + INSPIRED_BY.length;
    const named = hits.find((hit) => hit.at === next);
    found.push(
      named
        ? reason("inspired_by", "block", `Product titles cannot say "inspired by" another brand ("${named.mark.markText}").`, named.mark.markText ?? undefined)
        : reason("inspired_by", "flag", 'Titles that say "inspired by" often name someone else\'s product. A person will look at it.', "inspired by"),
    );
  }
  return found;
}

/** Screens one text in one context against the offensive-word list and the given marks. */
export function screenTextContent(text: string, context: TextContext, marks: readonly Mark[]): Verdict {
  const words = wordsOf(text);
  const hits = markHits(words, marks);
  const reasons = [...offensive(words), ...brandTerms(hits, context), ...(context === "title" ? titleRules(words, hits) : [])];
  return verdictOf(reasons);
}
