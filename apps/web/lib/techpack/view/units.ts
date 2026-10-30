/**
 * The tech pack view's unit toggle (spec F-S6: **mm | cm | in**). Every length the view holds is a
 * whole number of millimetres, because that is what the base article catalogue stores
 * (`article_poms.values_mm`, X1) and what `docs/spec/articles/JSY-SS-01/article.json` is written
 * in. Centimetres and inches are for reading only: nothing is converted and stored back, so no
 * rounding can reach the design.
 */

export const LENGTH_UNITS = ["mm", "cm", "in"] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

/** What the toggle's three buttons say. */
export const UNIT_LABELS: Readonly<Record<LengthUnit, string>> = { mm: "mm", cm: "cm", in: "in" };

/** The whole word, for a column heading and for a screen reader. */
export const UNIT_NAMES: Readonly<Record<LengthUnit, string>> = {
  mm: "millimetres",
  cm: "centimetres",
  in: "inches",
};

const MM_PER_CM = 10;
/** The international inch, exactly 25.4 mm. */
const MM_PER_INCH = 25.4;

/** How many decimal places each unit reads to, so one length reads the same wherever it is shown. */
const PLACES: Readonly<Record<LengthUnit, number>> = { mm: 0, cm: 1, in: 2 };

const DIVISOR: Readonly<Record<LengthUnit, number>> = { mm: 1, cm: MM_PER_CM, in: MM_PER_INCH };

/** A length in millimetres as the chosen unit reads it. Null stays null: nothing is made up for a value nobody has. */
export function formatLength(mm: number | null, unit: LengthUnit): string | null {
  if (mm === null || !Number.isFinite(mm)) return null;
  return (mm / DIVISOR[unit]).toFixed(PLACES[unit]);
}

/** The same, with the unit after it, for a cell that stands on its own. */
export function formatLengthWithUnit(mm: number | null, unit: LengthUnit): string | null {
  const text = formatLength(mm, unit);
  return text === null ? null : `${text} ${UNIT_LABELS[unit]}`;
}

/** A tolerance, which is read with its sign: `+10`, `-10`, and plain `0` with none. */
export function formatSigned(mm: number | null, unit: LengthUnit, sign: "+" | "-"): string | null {
  const text = formatLength(mm, unit);
  if (text === null) return null;
  return Number(text) === 0 ? text : `${sign}${text}`;
}
