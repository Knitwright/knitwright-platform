/**
 * Centimetres or inches for showing a length (plan step 15, task 4). The design always stores
 * centimetres; inches are for reading only, so a factory file never changes with the toggle.
 */

export type LengthUnit = "cm" | "in";

export const CM_PER_INCH = 2.54;

/** Eighths of an inch: what a tape measure marks. */
const EIGHTHS = 8;

export const cmToInches = (cm: number): number => cm / CM_PER_INCH;

export const inchesToCm = (inches: number): number => inches * CM_PER_INCH;

const FRACTIONS: Readonly<Record<number, string>> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" };

function inchesText(cm: number): string {
  const eighths = Math.round(cmToInches(cm) * EIGHTHS);
  const whole = Math.floor(eighths / EIGHTHS);
  const part = FRACTIONS[eighths % EIGHTHS];
  if (part === undefined) return `${whole} in`;
  return whole === 0 ? `${part} in` : `${whole} ${part} in`;
}

/** A length in centimetres, written in the unit asked for. */
export function formatLength(cm: number, unit: LengthUnit): string {
  return unit === "in" ? inchesText(cm) : `${cm.toFixed(1)} cm`;
}

/** The unit named in an address or a saved choice. Anything but "in" means centimetres. */
export const lengthUnitFrom = (value: unknown): LengthUnit => (value === "in" ? "in" : "cm");
