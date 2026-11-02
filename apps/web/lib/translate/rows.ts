import { z } from "zod";
import { ruleIdSchema } from "@/lib/factory/schemas";
import { TRANSLATION_KEYS } from "./keys";
import { LANGUAGES } from "./languages";

/**
 * `translation_strings` as the app sees it (decision 0102). Rows come from
 * `20261210030000_australia_and_translate.sql`.
 *
 * The one field that matters most is `reviewedBy`. A translation is a claim about what a sentence means,
 * so the row records who read it against the English, what their role was and the day they read it. Null
 * means nobody has, and every screen and every page that shows the words says so. A row that a
 * translation service produced carries `machine true`, and the database refuses such a row that also
 * claims a reviewer: a machine translation is never recorded as reviewed.
 */

export const translationRowSchema = z.object({
  id: z.uuid(),
  key: z.enum(TRANSLATION_KEYS),
  language: z.enum(LANGUAGES),
  text: z.string().min(1).max(400),
  sourceLanguage: z.string().min(2).max(5),
  /** Who or what produced these words. */
  translatedBy: z.string().min(1).max(120),
  machine: z.boolean(),
  /** The person who read it against the English. Null: nobody has. */
  reviewedBy: z.string().min(1).max(120).nullable(),
  reviewedRole: z.string().min(1).max(120).nullable(),
  /** The day they read it, as yyyy-mm-dd. */
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(300),
});
export type TranslationRow = z.output<typeof translationRowSchema>;

export const TRANSLATION_COLUMNS =
  "id, key, language, text, source_language, translated_by, machine, reviewed_by, reviewed_role, reviewed_on, rule_id, label";

type Row = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

/** One row, or null when it is for a key or a language this version of the app does not know. */
export function toTranslationRow(r: Row): TranslationRow | null {
  const parsed = translationRowSchema.safeParse({
    id: r.id,
    key: r.key,
    language: r.language,
    text: r.text,
    sourceLanguage: r.source_language,
    translatedBy: r.translated_by,
    machine: r.machine === true,
    reviewedBy: str(r.reviewed_by),
    reviewedRole: str(r.reviewed_role),
    reviewedOn: typeof r.reviewed_on === "string" ? r.reviewed_on.slice(0, 10) : null,
    ruleId: r.rule_id,
    label: r.label,
  });
  return parsed.success ? parsed.data : null;
}

/** Every row the library could give that this version of the app understands. */
export const toTranslationRows = (rows: readonly Row[]): readonly TranslationRow[] =>
  rows.flatMap((row) => toTranslationRow(row) ?? []);

/** "Reviewed by NAME, ROLE, on DATE", as a factory confirmation reads (owner decision 14). Null: nobody has. */
export const reviewLine = (row: Pick<TranslationRow, "reviewedBy" | "reviewedRole" | "reviewedOn">): string | null =>
  row.reviewedBy === null || row.reviewedRole === null || row.reviewedOn === null
    ? null
    : `Reviewed by ${row.reviewedBy}, ${row.reviewedRole}, on ${row.reviewedOn}`;
