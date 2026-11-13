import type { PomRow } from "../view/measurements";

/**
 * The single "Tol ±" column of spec screen 30, read from the row's two tolerances. A symmetric
 * tolerance reads as one number; an uneven one keeps both ends; a missing one stays missing (plan v5
 * decision 18: no tolerance is ever invented, so a null is never drawn as a nought).
 */
export function toleranceText(row: Pick<PomRow, "tolMinus" | "tolPlus">): string | null {
  const { tolMinus, tolPlus } = row;
  if (tolMinus === null && tolPlus === null) return null;
  const minus = tolMinus?.replace(/^-/, "") ?? null;
  const plus = tolPlus?.replace(/^\+/, "") ?? null;
  if (minus !== null && minus === plus) return minus;
  return `−${minus ?? "?"} / +${plus ?? "?"}`;
}
