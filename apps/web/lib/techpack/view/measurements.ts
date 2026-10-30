import type { ArticlePom, BaseArticle, GradeType } from "@/lib/catalogue";
import { GAP_RULE, type FieldProvenance } from "@/lib/kpp/model";
import { formatLength, formatSigned, type LengthUnit } from "./units";

/**
 * The Measurements tab (spec F-S6): the point-of-measure table with its **Measurement | Grading**
 * toggle, the letter, the measurement, the grade type, the grade, the two tolerances, one column
 * per size with the sample size highlighted, and the rule that explains the row.
 *
 * Three rules shape this file, and each is a rule a tech pack can break by being helpful:
 *
 * 1. **A grade comes from the base article and is locked** (spec F-S6 rules). The row carries the
 *    letter, grade type and grade X1 seeded from the article, with `locked: true` and its rule id,
 *    so the panel draws a lock and a "Why?" beside it.
 * 2. **A point of measure with no tolerance keeps none** (plan v5 decision 18). The spec's
 *    ±10/5/3 mm defaults are placeholders and are never adopted here. A missing tolerance reads
 *    "Needs your input" and the Review tab lists it as a question for the factory.
 * 3. **An extra point of measure is the founder's own QC** (spec F-S6). It is measured on the
 *    sample, not graded: its grade type is `ungraded`, it has no grade and it carries a value only
 *    for the sample size. Nothing is worked out for the other sizes.
 */

export const MEASUREMENT_MODES = ["measurement", "grading"] as const;
export type MeasurementMode = (typeof MEASUREMENT_MODES)[number];

export const MODE_LABELS: Readonly<Record<MeasurementMode, string>> = {
  measurement: "Measurement",
  grading: "Grading",
};

/**
 * The grade types X1's `article_poms.grade_type` holds, in the words the spec uses. Spec F-S6 names
 * three (Linear / Non-linear / Ungraded) and `article.json` uses a fourth, `fixed`, for a point
 * that does not change across the size run (the back neck drop and the neck rib height). It is kept
 * and shown as "Fixed": calling it Ungraded would lose the article's own distinction.
 */
export const GRADE_TYPE_LABELS: Readonly<Record<GradeType, string>> = {
  linear: "Linear",
  non_linear: "Non-linear",
  ungraded: "Ungraded",
  fixed: "Fixed",
};

/** The grade types that do not change across the size run, so the row shows no grade step. */
const UNGRADED: readonly GradeType[] = ["ungraded", "fixed"];

/** An extra point of measure a founder added for their own QC: measured on the sample, never graded. */
export type ExtraPom = Readonly<{
  letter: string;
  description: string;
  /** What the person measured or drew, in millimetres, at the sample size. Null while nothing is measured. */
  sampleMm: number | null;
  ruleId: string | null;
}>;

/** One size column. The sample size is the one the grade is worked from, and is highlighted. */
export type SizeColumn = Readonly<{ size: string; isSample: boolean }>;

/** One size's value on one row, already read in the chosen unit. */
export type SizeValue = Readonly<{ size: string; isSample: boolean; text: string | null }>;

export type PomRow = Readonly<{
  letter: string;
  code: string;
  description: string;
  gradeType: GradeType;
  gradeTypeLabel: string;
  /** The grade step, read in the chosen unit, or null for a row that does not grade. */
  grade: string | null;
  tolMinus: string | null;
  tolPlus: string | null;
  values: readonly SizeValue[];
  ruleId: string;
  /** True while the base article fixes the grade: the panel draws a lock and a "Why?". */
  locked: boolean;
  /** `from_base` for one of the article's own points, `needs_input` for an extra one with nothing measured. */
  provenance: FieldProvenance;
  /** True for a point the founder added, which the base does not grade. */
  isExtra: boolean;
}>;

export type MeasurementsView = Readonly<{
  mode: MeasurementMode;
  unit: LengthUnit;
  columns: readonly SizeColumn[];
  rows: readonly PomRow[];
  /** The letters the base article already covers, so Auto-map knows what it would add. */
  note: string | null;
}>;

const NO_ARTICLE = "This design is not on a base article the catalogue covers, so it has no points of measure yet.";
const NO_POMS = "The base article has no points of measure on file yet; the factory has not returned them.";

/** A tolerance the source does not give stays absent. Zero is a real tolerance and is kept. */
const tolerance = (mm: number | null | undefined, unit: LengthUnit, sign: "+" | "-"): string | null =>
  mm === null || mm === undefined ? null : formatSigned(mm, unit, sign);

const columnsFor = (sizes: readonly string[], sampleSize: string | null): readonly SizeColumn[] =>
  sizes.map((size) => ({ size, isSample: size === sampleSize }));

function rowFor(pom: ArticlePom, columns: readonly SizeColumn[], unit: LengthUnit): PomRow {
  const graded = !UNGRADED.includes(pom.gradeType);
  return {
    letter: pom.letter,
    code: pom.code,
    description: pom.description,
    gradeType: pom.gradeType,
    gradeTypeLabel: GRADE_TYPE_LABELS[pom.gradeType],
    grade: graded ? formatLength(pom.gradeMm, unit) : null,
    tolMinus: tolerance(pom.tolMinusMm, unit, "-"),
    tolPlus: tolerance(pom.tolPlusMm, unit, "+"),
    values: columns.map((column) => ({
      size: column.size,
      isSample: column.isSample,
      text: formatLength(pom.valuesMm[column.size] ?? null, unit),
    })),
    ruleId: pom.ruleId === "" ? GAP_RULE : pom.ruleId,
    locked: true,
    provenance: "from_base",
    isExtra: false,
  };
}

/**
 * An extra point of measure. It is ungraded by construction: it has no grade, no tolerance the
 * base supplies, and a value only in the sample size's column. The other columns stay empty, so
 * nothing on the row can be read as a graded measurement the factory has to hit.
 */
function extraRowFor(extra: ExtraPom, columns: readonly SizeColumn[], unit: LengthUnit): PomRow {
  const text = formatLength(extra.sampleMm, unit);
  return {
    letter: extra.letter,
    code: extra.letter,
    description: extra.description,
    gradeType: "ungraded",
    gradeTypeLabel: GRADE_TYPE_LABELS.ungraded,
    grade: null,
    // Decision 18: an extra point has no tolerance until the factory gives one, and none is invented.
    tolMinus: tolerance(null, unit, "-"),
    tolPlus: tolerance(null, unit, "+"),
    values: columns.map((column) => ({ size: column.size, isSample: column.isSample, text: column.isSample ? text : null })),
    ruleId: extra.ruleId === null || extra.ruleId === "" ? GAP_RULE : extra.ruleId,
    locked: false,
    provenance: text === null ? "needs_input" : "from_design",
    isExtra: true,
  };
}

export type MeasurementsInput = Readonly<{
  article: BaseArticle | null;
  sizes: readonly string[];
  extras: readonly ExtraPom[];
  mode: MeasurementMode;
  unit: LengthUnit;
}>;

/** The whole table: the article's own points in the order X1 seeded them, then the founder's extras. */
export function buildMeasurements(input: MeasurementsInput): MeasurementsView {
  const { article, extras, mode, unit } = input;
  const sizes = input.sizes.length > 0 ? input.sizes : (article?.sizeRange ?? []);
  const columns = columnsFor(sizes, article?.sampleSize ?? null);
  const rows = [
    ...(article?.poms ?? []).map((pom) => rowFor(pom, columns, unit)),
    ...extras.map((extra) => extraRowFor(extra, columns, unit)),
  ];
  return { mode, unit, columns, rows, note: noteFor(article, rows) };
}

const noteFor = (article: BaseArticle | null, rows: readonly PomRow[]): string | null => {
  if (!article) return NO_ARTICLE;
  return rows.length === 0 ? NO_POMS : null;
};

/**
 * Auto-map (spec F-S6 toolbar: "places the base's standard POMs"). It reports what pressing the
 * button would place: the base's own letters, and whether any of them is already on the table. It
 * adds nothing itself, because the base's points are already every row of the table — so the
 * honest answer, when they are all there, is that there is nothing to place.
 */
export type AutoMapPlan = Readonly<{
  /** The letters the base article offers. */
  letters: readonly string[];
  /** The letters not on the table, which pressing the button would place. */
  missing: readonly string[];
  message: string;
}>;

export function autoMapPlan(article: BaseArticle | null, rows: readonly PomRow[]): AutoMapPlan {
  const letters = (article?.poms ?? []).map((pom) => pom.letter);
  const shown = new Set(rows.map((row) => row.letter));
  const missing = letters.filter((letter) => !shown.has(letter));
  return { letters, missing, message: autoMapMessage(letters, missing) };
}

const autoMapMessage = (letters: readonly string[], missing: readonly string[]): string => {
  if (letters.length === 0) return "The base article has no standard points of measure to place.";
  if (missing.length === 0) return `All ${letters.length} of the base article's points of measure are already on the table.`;
  return `${missing.length} of the base article's points of measure are not on the table: ${missing.join(", ")}.`;
};

/** The next free letter for an extra point: the first of A to Z nothing uses, or `Q1`, `Q2` once they run out. */
export function nextExtraLetter(taken: readonly string[]): string {
  const used = new Set(taken.map((letter) => letter.toUpperCase()));
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index);
    if (!used.has(letter)) return letter;
  }
  for (let index = 1; ; index += 1) {
    const letter = `Q${index}`;
    if (!used.has(letter)) return letter;
  }
}
