import { MEASUREMENT_MAX_TENTHS_MM } from "@/lib/garment";
import { parseCm, type CmResult } from "@/lib/sizing/cm";

/**
 * The units a brand's size chart file may be written in: centimetres or inches (owner
 * decision 2026-09-30). The unit is chosen on the mapping screen, or read row by row from a
 * units column. Whatever the file uses, the chart is stored in centimetres (whole tenths of a
 * millimetre), so every drawing, tech pack and export works as before. A unit that is not
 * one of these is refused, never guessed.
 */

export const CHART_UNITS = ["cm", "in"] as const;
export type ChartUnit = (typeof CHART_UNITS)[number];

export const UNIT_WORDS: Readonly<Record<ChartUnit, string>> = { cm: "centimetres", in: "inches" };

const UNIT_NAMES: Readonly<Record<string, ChartUnit>> = {
  cm: "cm",
  cms: "cm",
  centimetre: "cm",
  centimetres: "cm",
  centimeter: "cm",
  centimeters: "cm",
  in: "in",
  ins: "in",
  inch: "in",
  inches: "in",
  '"': "in",
  "″": "in",
};

type UnitReading = Readonly<{ ok: true; unit: ChartUnit | null }> | Readonly<{ ok: false }>;

/** The unit a cell names. An empty cell names none, so the unit chosen on the screen applies. */
export function readChartUnit(cell: string): UnitReading {
  const text = cell.trim().toLowerCase().replace(/\.$/, "");
  if (text === "") return { ok: true, unit: null };
  const unit = UNIT_NAMES[text];
  return unit ? { ok: true, unit } : { ok: false };
}

/** A tenth of a millimetre is 1/254 of an inch. */
const TENTHS_MM_PER_INCH = 254;
/** Three decimal places of an inch (0.125) is finer than a tape measure reads. */
const MAX_INCH_DECIMALS = 3;
/** Halves to sixty-fourths: the fractions a tape measure or a chart writes. */
const FRACTION_DENOMINATORS = new Set([2, 4, 8, 16, 32, 64]);
const FORMULA_STARTS = ["=", "+", "@", "-"];

const VULGAR: Readonly<Record<string, string>> = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;
const FRACTION = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/;

const withinLimit = (tenthsMm: number): CmResult =>
  Number.isSafeInteger(tenthsMm) && tenthsMm <= MEASUREMENT_MAX_TENTHS_MM
    ? { ok: true, tenthsMm }
    : { ok: false, reason: "too-large" };

function fromDecimal(match: RegExpExecArray): CmResult {
  const whole = Number(match[1] ?? "");
  const digits = (match[2] ?? "").replace(/0+$/, "");
  if (digits.length > MAX_INCH_DECIMALS) return { ok: false, reason: "too-precise" };
  const scale = 10 ** digits.length;
  const inchesTimesScale = whole * scale + Number(digits || "0");
  return withinLimit(Math.round((inchesTimesScale * TENTHS_MM_PER_INCH) / scale));
}

function fromFraction(match: RegExpExecArray): CmResult {
  const whole = Number(match[1] ?? "0");
  const numerator = Number(match[2] ?? "");
  const denominator = Number(match[3] ?? "");
  if (!FRACTION_DENOMINATORS.has(denominator) || numerator < 1 || numerator >= denominator) {
    return { ok: false, reason: "not-a-number" };
  }
  return withinLimit(Math.round(((whole * denominator + numerator) * TENTHS_MM_PER_INCH) / denominator));
}

/**
 * Reads inches typed as text, as a decimal (20.5) or with a fraction (20 1/2, 20½), and gives
 * whole tenths of a millimetre, rounded to the nearest. Cells that start with a formula
 * character are text and are never worked out.
 */
export function parseInches(text: string): CmResult {
  const cell = Object.entries(VULGAR)
    .reduce((acc, [glyph, fraction]) => acc.replace(glyph, ` ${fraction}`), text)
    .trim()
    .replace(/\s+/g, " ");
  if (cell === "") return { ok: false, reason: "empty" };
  if (cell.startsWith("-") && (DECIMAL.test(cell.slice(1)) || FRACTION.test(cell.slice(1)))) {
    return { ok: false, reason: "negative" };
  }
  if (FORMULA_STARTS.some((start) => cell.startsWith(start))) return { ok: false, reason: "formula" };
  const decimal = DECIMAL.exec(cell);
  if (decimal) return fromDecimal(decimal);
  const fraction = FRACTION.exec(cell);
  if (fraction) return fromFraction(fraction);
  return { ok: false, reason: "not-a-number" };
}

/** Reads a length in the given unit, as whole tenths of a millimetre. */
export const readLength = (text: string, unit: ChartUnit): CmResult =>
  unit === "in" ? parseInches(text) : parseCm(text);
