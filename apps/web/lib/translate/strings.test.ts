import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLOSING_PAGES, TECH_PACK_PAGES } from "@/lib/techpack/exports/pages";
import { PAGE_TITLE_KEYS, TRANSLATION_KEYS, isTranslationKey, pageTitleKey } from "./keys";
import { LANGUAGES, LANGUAGE_FACTS, SOURCE_LANGUAGE, directionOf, isLanguage, isRightToLeft, languageFrom } from "./languages";
import { DRAFT_STRINGS, ENGLISH, KNITWRIGHT_DRAFT, URDU_DRAFT_LABEL } from "./strings";

/**
 * The words of a translated document, against the two files they have to agree with: the migration that
 * seeds the rows, and the page plan the English titles come from.
 */

const MIGRATION = join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261210030000_australia_and_translate.sql");
const migration = (): string => readFileSync(MIGRATION, "utf8");

/** The seeded rows of the migration: key, language, words and the label. */
function seeded(): readonly Readonly<{ key: string; language: string; text: string; label: string }>[] {
  const found = [...migration().matchAll(/\('([a-z.-]+)', '([a-z-]+)', '(.+?)', 'knitwright-draft', false, 'R-GAP-000',\s*'(.+?)'\)/gu)];
  return found.map((match) => ({ key: match[1]!, language: match[2]!, text: match[3]!.replaceAll("''", "'"), label: match[4]! }));
}

describe("the languages a document can be set in", () => {
  it("is English, the language every value is written in, and Urdu for the factory floor", () => {
    expect(LANGUAGES).toEqual(["en", "ur"]);
    expect(SOURCE_LANGUAGE).toBe("en");
    expect(LANGUAGE_FACTS.ur.endonym).toBe("اردو");
  });

  it("reads Urdu right to left and English left to right", () => {
    expect(directionOf("ur")).toBe("rtl");
    expect(isRightToLeft("ur")).toBe(true);
    expect(isRightToLeft("en")).toBe(false);
  });

  it("falls back to English for anything an address can carry that is not a language", () => {
    expect(languageFrom("ur")).toBe("ur");
    expect(languageFrom(["ur", "en"])).toBe("ur");
    expect(languageFrom("klingon")).toBe("en");
    expect(languageFrom(undefined)).toBe("en");
    expect(languageFrom([])).toBe("en");
    expect(isLanguage("ur")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
  });
});

describe("the keys a document can translate", () => {
  it("has one title for every page of the PDF, and no title for a page that does not exist", () => {
    const pages = [...TECH_PACK_PAGES.map((page) => page.id), ...CLOSING_PAGES.map((page) => page.id)];
    expect(PAGE_TITLE_KEYS).toEqual(pages.map((id) => `page.${id}`));
    for (const id of pages) expect(pageTitleKey(id), id).toBe(`page.${id}`);
    expect(pageTitleKey("no-such-page")).toBeNull();
    expect(isTranslationKey("page.overview")).toBe(true);
    expect(isTranslationKey("page.nowhere")).toBe(false);
  });

  it("says in English exactly what every page of the plan is called", () => {
    for (const page of TECH_PACK_PAGES) expect(ENGLISH[`page.${page.id}`], page.id).toBe(page.title);
    for (const page of CLOSING_PAGES) expect(ENGLISH[`page.${page.id}`], page.id).toBe(page.title);
  });

  it("gives every key an English word and a word in every other language", () => {
    for (const key of TRANSLATION_KEYS) {
      for (const language of LANGUAGES) expect(DRAFT_STRINGS[language][key], `${language} ${key}`).not.toBe("");
    }
  });
});

describe("the Urdu draft against the rows the migration seeds", () => {
  const rows = seeded();

  it("seeds one row for every key, in Urdu and nothing else", () => {
    expect(rows.map((row) => row.key)).toEqual([...TRANSLATION_KEYS]);
    for (const row of rows) expect(row.language, row.key).toBe("ur");
  });

  it("seeds the same words as the draft in the code", () => {
    for (const row of rows) expect(row.text, row.key).toBe(DRAFT_STRINGS.ur[row.key as (typeof TRANSLATION_KEYS)[number]]);
  });

  it("labels every seeded row as a draft no Urdu speaker has read, and names no reviewer", () => {
    for (const row of rows) expect(row.label, row.key).toBe(URDU_DRAFT_LABEL);
    expect(URDU_DRAFT_LABEL).toContain("No Urdu speaker has read");
    // The seed names no reviewer column at all, so no seeded row can claim one.
    expect(migration()).toContain("insert into public.translation_strings (key, language, text, translated_by, machine, rule_id, label) values");
    expect(KNITWRIGHT_DRAFT).toBe("knitwright-draft");
  });

  it("writes every Urdu word in the Arabic script, so nothing was left in English by mistake", () => {
    for (const key of TRANSLATION_KEYS) {
      expect(DRAFT_STRINGS.ur[key], key).toMatch(/\p{Script=Arabic}/u);
      expect(DRAFT_STRINGS.ur[key], key).not.toBe(ENGLISH[key]);
    }
  });

  it("refuses a machine translation that claims a reviewer, in the database itself", () => {
    expect(migration()).toContain("constraint machine_translation_is_never_reviewed check (not machine or reviewed_by is null)");
  });
});
