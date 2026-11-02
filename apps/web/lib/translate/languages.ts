/**
 * The languages the platform can set a document in (spec F-S6 "Translate", `docs/spec/06-build-plan.md`
 * phase 3 item 12; plan v5 O3, decision 0102).
 *
 * English is the language every value is written in and the one a factory works to. Urdu is for the
 * floor staff in Sialkot, who read the pack rather than the brief. Nothing here is a translation: the
 * words themselves are rows of `translation_strings`, each with the person who read it against the
 * English (`rows.ts`).
 */

export const LANGUAGES = ["en", "ur"] as const;
export type Language = (typeof LANGUAGES)[number];

export const SOURCE_LANGUAGE: Language = "en";

/** Which way the language reads. Urdu is written in the Arabic script, right to left. */
export type Direction = "ltr" | "rtl";

export interface LanguageFacts {
  readonly id: Language;
  /** What a control says, in English, because the control is on an English screen. */
  readonly label: string;
  /** The language's own name, which a reader of that language looks for. */
  readonly endonym: string;
  readonly direction: Direction;
}

export const LANGUAGE_FACTS: Readonly<Record<Language, LanguageFacts>> = {
  en: { id: "en", label: "English", endonym: "English", direction: "ltr" },
  ur: { id: "ur", label: "Urdu", endonym: "اردو", direction: "rtl" },
};

export const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);

/** The language an address or a form asks for. Anything else reads as English, so a mistyped link still works. */
export const languageFrom = (value: string | readonly string[] | undefined): Language => {
  const asked = Array.isArray(value) ? value[0] : value;
  return typeof asked === "string" && isLanguage(asked) ? asked : SOURCE_LANGUAGE;
};

export const directionOf = (language: Language): Direction => LANGUAGE_FACTS[language].direction;

export const isRightToLeft = (language: Language): boolean => directionOf(language) === "rtl";
