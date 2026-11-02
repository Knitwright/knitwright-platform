import {
  PDF_FONT_FAMILY,
  PDF_FONT_FILE,
  PDF_URDU_FONT_FAMILY,
  PDF_URDU_FONT_FILE,
  registerPdfFont,
  registerPdfUrduFont,
} from "@/lib/flat/pdf-font";
import { dictionaryFor, type Dictionary } from "@/lib/translate/dictionary";
import type { TranslationKey } from "@/lib/translate/keys";
import { SOURCE_LANGUAGE, type Direction, type Language } from "@/lib/translate/languages";
import type { TranslationRow } from "@/lib/translate/rows";
import { drawableIn, hasUndrawableIn } from "../pdf-text";

/**
 * How a document is set: the font, the reading direction, and the fixed words in the document's own
 * language (plan v5 O3, decision 0103).
 *
 * It is one callable value because the three cannot be separated. A character is drawable only in a
 * particular font, a font belongs to a script, and a script reads one way or the other; a PDF that
 * made text safe against one font and drew it in another would print question marks or the wrong
 * glyphs. Every piece of text in the document already passes through `safe`, so the font and the
 * direction travel with it and no call site has to be told twice.
 */
export interface Safe {
  /** Turns text into text this document's font can draw. Every string in the PDF passes through it. */
  (text: string): string;
  readonly language: Language;
  readonly family: string;
  readonly direction: Direction;
  /** "row" or, right to left, "row-reverse": the order the cells of a table run in. */
  readonly row: "row" | "row-reverse";
  /** The fixed words of the document in its own language. */
  readonly words: (key: TranslationKey) => string;
  /** Null for English, which is not a translation. Otherwise the notice every page carries. */
  readonly unreviewedNotice: string | null;
  /** Null for English. Otherwise what is in the document's language and what is not. */
  readonly scopeNotice: string | null;
  /** True when a character the font lacks would be shown as a question mark. */
  readonly lacks: (text: string) => boolean;
}

const FONTS: Readonly<Record<Language, Readonly<{ family: string; file: string }>>> = {
  en: { family: PDF_FONT_FAMILY, file: PDF_FONT_FILE },
  ur: { family: PDF_URDU_FONT_FAMILY, file: PDF_URDU_FONT_FILE },
};

/** Registers the fonts one language's pages need. Safe to call before every render. */
export function registerFontsFor(language: Language): void {
  if (language === SOURCE_LANGUAGE) registerPdfFont();
  else registerPdfUrduFont();
}

/**
 * The typeset for one language, over the words the library holds. A language with no rows falls back
 * to the draft in `lib/translate/strings.ts`, which is labelled and unreviewed, so a document can
 * always be set even when the library cannot be read.
 */
export function typesetFor(language: Language, rows: readonly TranslationRow[] = []): Safe {
  return typesetOf(dictionaryFor(language, rows));
}

/** The typeset over a dictionary that has already been built. */
export function typesetOf(dictionary: Dictionary): Safe {
  const { family, file } = FONTS[dictionary.language];
  const translated = dictionary.language !== SOURCE_LANGUAGE;
  const safe = (text: string): string => drawableIn(file, text);
  return Object.assign(safe, {
    language: dictionary.language,
    family,
    direction: dictionary.direction,
    row: (dictionary.direction === "rtl" ? "row-reverse" : "row") as "row" | "row-reverse",
    words: (key: TranslationKey): string => safe(dictionary.words(key).text),
    unreviewedNotice: translated && !dictionary.reviewed ? safe(dictionary.words("notice.unreviewed").text) : null,
    scopeNotice: translated ? safe(dictionary.words("notice.scope").text) : null,
    lacks: (text: string): boolean => hasUndrawableIn(file, text),
  });
}

/** The typeset of an English document, which is what every export was before this one. */
export const ENGLISH_TYPESET: Safe = typesetFor(SOURCE_LANGUAGE);
