/**
 * Every length in a garment spec is a whole number of tenths of a millimetre.
 * So 52.5 cm is stored as 5250. Whole numbers avoid rounding drift when a value is
 * saved, graded or exported. Centimetres are for display and typing only.
 */

/** One centimetre is ten millimetres, and each millimetre is ten tenths. */
export const TENTHS_MM_PER_CM = 100;

/**
 * The largest length the contract accepts, which is three metres. This is a sanity
 * limit that catches typing slips. It is not a size for any garment.
 */
export const MEASUREMENT_MAX_TENTHS_MM = 30_000;

const TENTHS_MM_PER_TENTH_CM = 10;
const TENTHS_OF_CM_PER_CM = 10;

/** Turns centimetres into stored units. Returns null when the input is not a finite number. */
export function cmToTenthsMm(cm: number): number | null {
  if (!Number.isFinite(cm)) return null;
  return Math.round(cm * TENTHS_MM_PER_CM);
}

/** Turns stored units into centimetres, without rounding. */
export function tenthsMmToCm(tenthsMm: number): number {
  return tenthsMm / TENTHS_MM_PER_CM;
}

/** Text for display in centimetres, rounded to one decimal place. */
export function formatCm(tenthsMm: number): string {
  const tenthsOfCm = Math.round(tenthsMm / TENTHS_MM_PER_TENTH_CM);
  return (tenthsOfCm / TENTHS_OF_CM_PER_CM).toFixed(1);
}
