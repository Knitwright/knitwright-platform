import { GAP_RULE_ID, RULE_ID } from "../constants";
import type { TechpackField } from "./types";

/**
 * Drafting the tech pack's overview sentences from the base article's construction table (spec F-S5 v2, plan v5
 * Z2), each with provenance `from_base` and the rule id the construction row carries.
 *
 * No model is involved and nothing is composed: a sentence is the row's own seam name, its own operation and its
 * own stitch density, joined with punctuation. That is the whole point. A tech-pack field is what a factory sews
 * from, so the words a founder reads there are the base article's words, and the "Why?" beside the field opens
 * the rule the row names. Nothing is added where the row is silent: a row with no stitch density gets no
 * sentence about stitch density, rather than a plausible one.
 *
 * `lib/rulebook/ask/techpack-fields.test.ts` reads every drafted sentence back for measurements and checks that
 * each one appears in the row it was drafted from, so no number can enter the tech pack through this path.
 */

/** One row of a base article's construction table. The smallest shape this needs (`lib/catalogue`'s own is wider). */
export type ConstructionRow = Readonly<{
  step: number;
  seam: string;
  operation: string;
  spi: string | null;
  ruleId: string;
}>;

/** The provenance every field drafted here carries: the words came from the base article, not from the design. */
export const FROM_BASE = "from_base" as const;

const stop = (text: string): string => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

const clean = (text: string | null): string => (text ?? "").trim();

/** A rule id a row names, or R-GAP-000 where it names none, so no field is ever without one. */
export const ruleOf = (row: ConstructionRow): string => (RULE_ID.test(clean(row.ruleId)) ? row.ruleId.trim() : GAP_RULE_ID);

/**
 * One overview sentence from one construction row: the seam, the operation as the base article writes it, and
 * the stitch density where the row states one, in the row's own words and units.
 */
export function overviewSentence(row: ConstructionRow): string | null {
  const seam = clean(row.seam);
  const operation = clean(row.operation);
  if (seam === "" || operation === "") return null;
  const density = clean(row.spi);
  return [stop(`${seam}: ${operation}`), density === "" ? null : stop(`Stitch density ${density}`)]
    .filter((part) => part !== null)
    .join(" ");
}

/**
 * The overview fields for an article's construction table, in the table's own order. A row with no seam or no
 * operation drafts nothing: an empty row is a question for the factory, not a sentence.
 */
export function overviewFields(construction: readonly ConstructionRow[]): TechpackField[] {
  return [...construction]
    .sort((a, b) => a.step - b.step)
    .flatMap((row) => {
      const text = overviewSentence(row);
      return text === null
        ? []
        : [{ key: `construction-${row.step}`, label: clean(row.seam), text, ruleId: ruleOf(row), provenance: FROM_BASE }];
    });
}

/** The rule ids the drafted fields rest on, each once, so the page can read them all in one go. */
export const ruleIdsOf = (fields: readonly TechpackField[]): string[] => [...new Set(fields.map((field) => field.ruleId))];
