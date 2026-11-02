import { TRANSLATION_KEYS, type TranslationKey } from "./keys";
import { SOURCE_LANGUAGE, directionOf, type Direction, type Language } from "./languages";
import { reviewLine, type TranslationRow } from "./rows";
import { DRAFT_STRINGS, ENGLISH, KNITWRIGHT_DRAFT, URDU_DRAFT_LABEL } from "./strings";

/**
 * The fixed words of a document in one language, each carrying whether anybody has read it (decision 0102).
 *
 * A dictionary is built from the rows of `translation_strings`, with the draft in `strings.ts` standing in
 * for a key the library has no row for. It is pure: the same rows give the same words and the same review
 * state every time, so a PDF of a design is the same file twice over.
 *
 * `reviewed` is the field everything else hangs off. It is true only when every word the document uses has
 * a named reviewer, which is false today for every language but English, and the renderer and the screens
 * both say so wherever the words appear.
 */

export interface TranslatedWord {
  readonly key: TranslationKey;
  readonly text: string;
  /** "Reviewed by NAME, ROLE, on DATE", or null while nobody has read it. */
  readonly review: string | null;
  readonly reviewed: boolean;
  /** Who or what produced the words. */
  readonly translatedBy: string;
  readonly machine: boolean;
  /** What the row says about itself, as every drafted value in the platform carries a label. */
  readonly label: string;
}

export interface Dictionary {
  readonly language: Language;
  readonly direction: Direction;
  /** The words for one key. Never throws and never comes back empty: the English word is the last resort. */
  words(key: TranslationKey): TranslatedWord;
  /** True only when every key the document can use has a named reviewer. */
  readonly reviewed: boolean;
  /** Every key with no named reviewer, in the order of `TRANSLATION_KEYS`. */
  readonly unreviewed: readonly TranslationKey[];
  /** True where the words came from the library rather than from the draft in the code. */
  readonly fromLibrary: boolean;
}

const ENGLISH_LABEL = "The words of the platform itself, written in English.";

/** English is not a translation: nothing is reviewed because nothing has been claimed about a meaning. */
const englishWord = (key: TranslationKey): TranslatedWord => ({
  key,
  text: ENGLISH[key],
  review: null,
  reviewed: true,
  translatedBy: KNITWRIGHT_DRAFT,
  machine: false,
  label: ENGLISH_LABEL,
});

const draftWord = (key: TranslationKey, language: Language): TranslatedWord => ({
  key,
  text: DRAFT_STRINGS[language][key],
  review: null,
  reviewed: false,
  translatedBy: KNITWRIGHT_DRAFT,
  machine: false,
  label: URDU_DRAFT_LABEL,
});

const rowWord = (key: TranslationKey, row: TranslationRow): TranslatedWord => {
  const review = reviewLine(row);
  return {
    key,
    text: row.text,
    review,
    // A machine translation is never read as reviewed, whatever a row claims.
    reviewed: review !== null && !row.machine,
    translatedBy: row.translatedBy,
    machine: row.machine,
    label: row.label,
  };
};

/**
 * The dictionary for one language, from the rows the library holds for it. Rows for another language are
 * ignored, and a key with no row falls back to the draft in `strings.ts`.
 */
export function dictionaryFor(language: Language, rows: readonly TranslationRow[] = []): Dictionary {
  const direction = directionOf(language);
  if (language === SOURCE_LANGUAGE) {
    return { language, direction, words: englishWord, reviewed: true, unreviewed: [], fromLibrary: false };
  }
  const byKey = new Map(rows.filter((row) => row.language === language).map((row) => [row.key, row]));
  const words = (key: TranslationKey): TranslatedWord => {
    const row = byKey.get(key);
    return row === undefined ? draftWord(key, language) : rowWord(key, row);
  };
  const unreviewed = TRANSLATION_KEYS.filter((key) => !words(key).reviewed);
  return { language, direction, words, reviewed: unreviewed.length === 0, unreviewed, fromLibrary: byKey.size > 0 };
}

/** The text for one key, which is all most callers want. */
export const textOf = (dictionary: Dictionary, key: TranslationKey): string => dictionary.words(key).text;
