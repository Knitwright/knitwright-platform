import { MEASUREMENT_MAX_TENTHS_MM, TENTHS_MM_PER_CM } from "@/lib/garment";

/**
 * Lengths are stored as whole tenths of a millimetre and typed in centimetres. Both
 * directions work on whole numbers, so a value such as 0.29 cm never drifts.
 */

/** A stored length as centimetres, with no rounding: 5250 is "52.5". */
export const cmText = (tenthsMm: number): string => String(tenthsMm / TENTHS_MM_PER_CM);

const MAX_CM_TEXT = cmText(MEASUREMENT_MAX_TENTHS_MM);
const TRY_AGAIN = "Enter a length in centimetres, such as 52.5.";
const OUT_OF_RANGE = `Enter a length above zero and up to ${MAX_CM_TEXT} cm.`;
const CM_PATTERN = /^(\d+)(?:[.,](\d{0,2}))?$/;

export type CmInput =
  | Readonly<{ ok: true; tenths: number }>
  | Readonly<{ ok: false; reason: string }>;

/** Reads centimetres typed by a person. Up to two decimal places, comma or point. */
export const parseCmInput = (text: string): CmInput => {
  const match = CM_PATTERN.exec(text.trim());
  if (!match) return { ok: false, reason: TRY_AGAIN };
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const tenths = whole * TENTHS_MM_PER_CM + fraction;
  if (tenths < 1 || tenths > MEASUREMENT_MAX_TENTHS_MM) return { ok: false, reason: OUT_OF_RANGE };
  return { ok: true, tenths };
};
