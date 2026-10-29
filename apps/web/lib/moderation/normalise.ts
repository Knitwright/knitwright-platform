/**
 * Text as the screens compare it: accents removed, lower case, common character swaps undone (N1ke, $hit), and split into
 * words. Matching is always by whole words, so "Scunthorpe", "Dickson" or "Essex" never match a word inside them.
 */

const SWAPS: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

const unswap = (word: string): string =>
  // Only a word that has a letter in it is undone, so a shirt number such as "10" stays a number.
  /\p{L}/u.test(word) ? [...word].map((ch) => SWAPS[ch] ?? ch).join("") : word;

/** The words of a text, normalised. */
export function wordsOf(text: string): readonly string[] {
  const plain = text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
  return plain
    .split(/[^\p{L}\p{N}@$!]+/u)
    .map((word) => unswap(word).replace(/[@$!]+/g, ""))
    .filter((word) => word.length > 0);
}

/** Where a phrase (already split into words) starts inside a list of words, or -1. */
export function findPhrase(words: readonly string[], phrase: readonly string[]): number {
  if (phrase.length === 0) return -1;
  for (let i = 0; i + phrase.length <= words.length; i += 1) {
    if (phrase.every((word, j) => words[i + j] === word)) return i;
  }
  return -1;
}
