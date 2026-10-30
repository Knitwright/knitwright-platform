/**
 * The two things a benchmark may never keep (spec F-S2 "Stored", plan Z3): page markup, and anybody's words copied
 * out. Everything written to the database goes through here first, so a copy cannot be stored even by mistake.
 */

/** A tag, a tag's opening, or an HTML entity: anything that came out of a page's source rather than its words. */
const MARKUP = /[<>]|&(?:[a-z]{2,10}|#\d{1,6}|#x[0-9a-f]{1,5});/i;

export const hasMarkup = (text: string): boolean => MARKUP.test(text);

/** Collapses whitespace and drops control characters, so one line of words is all that is ever stored. */
export const plain = (text: string): string => text.replace(/\p{C}/gu, " ").replace(/\s+/g, " ").trim();

/**
 * The most words a theme may share, word for word, with the words it came from. A complaint theme is a short
 * paraphrase; a longer verbatim run is a copy of a review, which is never stored. Eight words is a Knitwright draft
 * and an owner question, not a legal opinion.
 */
export const MAX_SHARED_WORDS = 8;

const words = (text: string): string[] =>
  plain(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** How many words of the theme run on, word for word, inside the source. */
export function longestSharedRun(theme: string, source: string): number {
  const said = words(theme);
  const haystack = ` ${words(source).join(" ")} `;
  let longest = 0;
  for (let from = 0; from < said.length; from += 1) {
    let run = longest + 1;
    while (from + run <= said.length && haystack.includes(` ${said.slice(from, from + run).join(" ")} `)) {
      longest = run;
      run += 1;
    }
  }
  return longest;
}

/** True when the theme says the complaint in our own words rather than copying the reviewer's. */
export const isParaphrase = (theme: string, source: string): boolean => longestSharedRun(theme, source) <= MAX_SHARED_WORDS;
