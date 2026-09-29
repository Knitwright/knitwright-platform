import { MEASUREMENT_MAX_TENTHS_MM, TENTHS_MM_PER_CM } from "@/lib/garment";

export type CmFailure =
  | "empty"
  | "formula"
  | "negative"
  | "not-a-number"
  | "too-precise"
  | "too-large";

export type CmResult =
  | { readonly ok: true; readonly tenthsMm: number }
  | { readonly ok: false; readonly reason: CmFailure };

/** Two decimal places of a centimetre is one tenth of a millimetre. */
const MAX_DECIMAL_PLACES = 2;
const PLAIN_NUMBER = /^(\d+)(?:\.(\d+))?$/;
const FORMULA_STARTS = ["=", "+", "@", "-"];

/**
 * Reads centimetres typed as text and gives whole tenths of a millimetre. It works on the
 * digits, never on floating point, so 52.5 is exactly 5250. Cells that start with a
 * formula character are text. A leading minus on a plain number is a negative number.
 */
export function parseCm(text: string): CmResult {
  const cell = text.trim();
  if (cell === "") return { ok: false, reason: "empty" };
  if (cell.startsWith("-") && PLAIN_NUMBER.test(cell.slice(1))) return { ok: false, reason: "negative" };
  if (FORMULA_STARTS.some((start) => cell.startsWith(start))) return { ok: false, reason: "formula" };
  const match = PLAIN_NUMBER.exec(cell);
  if (!match) return { ok: false, reason: "not-a-number" };
  const whole = match[1] ?? "";
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > MAX_DECIMAL_PLACES) return { ok: false, reason: "too-precise" };
  const tenthsMm = Number(whole) * TENTHS_MM_PER_CM + Number(fraction.padEnd(MAX_DECIMAL_PLACES, "0"));
  if (!Number.isSafeInteger(tenthsMm) || tenthsMm > MEASUREMENT_MAX_TENTHS_MM) {
    return { ok: false, reason: "too-large" };
  }
  return { ok: true, tenthsMm };
}
