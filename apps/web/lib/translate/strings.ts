import type { TranslationKey } from "./keys";
import type { Language } from "./languages";

/**
 * The English words each key stands for, and the labelled default of each translation (plan v5 O3,
 * decision 0104).
 *
 * The rows of `translation_strings` are what the platform runs on, exactly as the rows of
 * `platform_settings` are (`lib/settings/registry.ts`). This file holds the same words in code, for
 * three reasons: a document can still be set in another language when the library cannot be read, a
 * test holds these words to the ones the migration seeds, and another test holds the English words to
 * the page titles of `lib/techpack/exports/pages.ts`, so a page that is renamed and not retranslated
 * is caught here rather than on a factory floor.
 *
 * NOTHING HERE IS A REVIEWED TRANSLATION. Every Urdu word was written by Knitwright and no Urdu speaker
 * has read it. `dictionary.ts` carries that state with every word it hands out, and the PDF prints it on
 * every page.
 */

/** What the key means, in the language every value in the platform is written in. */
export const ENGLISH: Readonly<Record<TranslationKey, string>> = {
  "page.overview": "Overview",
  "page.technical-flats": "Technical flats",
  "page.colour-views": "Rendered colour views",
  "page.bom-fabrics": "Bill of materials: fabrics",
  "page.bom-parts": "Bill of materials: rib, thread, trims and labels",
  "page.construction": "Construction details",
  "page.construction-annotations": "Construction annotations",
  "page.measurement-annotation": "Measurement annotation",
  "page.size-grading": "Size grading",
  "page.graphics": "Graphics and prints",
  "page.print-placement": "Print placement",
  "page.personalisation": "Personalisation",
  "page.labels-packaging": "Labels and packaging",
  "page.colourways": "Colourways",
  "page.qc": "QC checklist",
  "page.reference-images": "Reference images",
  "page.sources-and-notes": "Sources and notes",
  "page.confirm-and-sign-off": "Still to confirm, and sign-off",
  "field.brand": "Brand",
  "field.style": "Style",
  "field.style-number": "Style number",
  "field.season": "Season",
  "field.base-size": "Base size",
  "field.version": "Version",
  "footer.page": "Page",
  "footer.of": "of",
  "value.to-be-confirmed": "To be confirmed",
  "notice.unreviewed": "Nobody who speaks this language has read this translation. Where the two copies differ, work to the English one.",
  "notice.scope":
    "Only the fixed words of the pages are in this language. Everything typed into the design, the table headers and the line under each title stay in English.",
};

/** What the label of every seeded Urdu row says about itself. The migration seeds this same sentence. */
export const URDU_DRAFT_LABEL = "Knitwright draft. No Urdu speaker has read this translation.";

/** Who wrote the seeded words. Not a translation service: `machine` is false on every seeded row. */
export const KNITWRIGHT_DRAFT = "knitwright-draft";

/**
 * The Urdu draft, word for word as `20261210030000_australia_and_translate.sql` seeds it. The words of
 * the tech pack's own furniture only: see `keys.ts` for what is left in English, and why.
 */
const URDU: Readonly<Record<TranslationKey, string>> = {
  "page.overview": "جائزہ",
  "page.technical-flats": "تکنیکی خاکے",
  "page.colour-views": "رنگین مناظر",
  "page.bom-fabrics": "اجزاء کی فہرست: کپڑے",
  "page.bom-parts": "اجزاء کی فہرست: رِب، دھاگہ، ٹرم اور لیبل",
  "page.construction": "سلائی کی تفصیلات",
  "page.construction-annotations": "سلائی کی نشان دہی",
  "page.measurement-annotation": "پیمائش کی نشان دہی",
  "page.size-grading": "سائز گریڈنگ",
  "page.graphics": "گرافکس اور پرنٹ",
  "page.print-placement": "پرنٹ کی جگہ",
  "page.personalisation": "نام اور نمبر",
  "page.labels-packaging": "لیبل اور پیکنگ",
  "page.colourways": "رنگوں کے امتزاج",
  "page.qc": "کوالٹی جانچ کی فہرست",
  "page.reference-images": "حوالہ تصاویر",
  "page.sources-and-notes": "حوالے اور نوٹس",
  "page.confirm-and-sign-off": "باقی تصدیق اور دستخط",
  "field.brand": "برانڈ",
  "field.style": "اسٹائل",
  "field.style-number": "اسٹائل نمبر",
  "field.season": "سیزن",
  "field.base-size": "بنیادی سائز",
  "field.version": "ورژن",
  "footer.page": "صفحہ",
  "footer.of": "از",
  "value.to-be-confirmed": "ابھی طے نہیں",
  "notice.unreviewed": "یہ اردو ترجمہ کسی اردو بولنے والے نے نہیں پڑھا۔ جہاں دونوں نقلوں میں فرق ہو، انگریزی نقل پر عمل کریں۔",
  "notice.scope":
    "صرف صفحات کے مستقل الفاظ اردو میں ہیں۔ ڈیزائن میں لکھے گئے الفاظ، جدولوں کے عنوان اور تفصیلی جملے انگریزی میں ہی ہیں۔",
};

/** The words of every language the platform ships a draft for. English is the source, never a translation. */
export const DRAFT_STRINGS: Readonly<Record<Language, Readonly<Record<TranslationKey, string>>>> = {
  en: ENGLISH,
  ur: URDU,
};
