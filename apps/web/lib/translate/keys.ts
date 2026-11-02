/**
 * Every fixed word of a document that can be set in another language (plan v5 O3, decision 0103).
 *
 * The list is closed on purpose. A key that is not here cannot be translated, and a key that is here
 * has an English word in `strings.ts` and a row per language in `translation_strings`. What is in the
 * list is the tech pack's own furniture: the title of each of its eighteen pages, the six fields of the
 * header block, the footer, the words for a value nobody has filled in, and the two notices an
 * unreviewed translation carries.
 *
 * What is deliberately NOT in the list: the explanatory line under each page title, the column headers
 * of the tables, and every word a person typed into the design. A tech pack is mostly the second of
 * those, and translating a person's own words would change what they wrote. `notice.scope` says so on
 * the page, so nobody on a factory floor has to work out which half of a page is in which language.
 */

/** One title per page of the PDF, keyed by the page ids of `lib/techpack/exports/pages.ts`. */
export const PAGE_TITLE_KEYS = [
  "page.overview",
  "page.technical-flats",
  "page.colour-views",
  "page.bom-fabrics",
  "page.bom-parts",
  "page.construction",
  "page.construction-annotations",
  "page.measurement-annotation",
  "page.size-grading",
  "page.graphics",
  "page.print-placement",
  "page.personalisation",
  "page.labels-packaging",
  "page.colourways",
  "page.qc",
  "page.reference-images",
  "page.sources-and-notes",
  "page.confirm-and-sign-off",
] as const;

export const TRANSLATION_KEYS = [
  ...PAGE_TITLE_KEYS,
  "field.brand",
  "field.style",
  "field.style-number",
  "field.season",
  "field.base-size",
  "field.version",
  "footer.page",
  "footer.of",
  "value.to-be-confirmed",
  /** Said on every page of a document whose translation nobody has read. */
  "notice.unreviewed",
  /** Says which parts of the page are in the other language and which are not. */
  "notice.scope",
] as const;
export type TranslationKey = (typeof TRANSLATION_KEYS)[number];

export const isTranslationKey = (value: string): value is TranslationKey =>
  (TRANSLATION_KEYS as readonly string[]).includes(value);

/** The key of one page's title, from the page id the PDF plan uses. */
export const pageTitleKey = (pageId: string): TranslationKey | null => {
  const key = `page.${pageId}`;
  return isTranslationKey(key) ? key : null;
};
