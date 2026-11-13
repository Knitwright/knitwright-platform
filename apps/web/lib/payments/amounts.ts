/**
 * Amounts and percentages as ops types them (plan v6 C1, decision 0152). No zod here: the ops forms are client
 * components and read these in the browser.
 */

/** An amount typed on the ops page ("1,250.50") in minor units, or null when it is not a positive amount. */
export const minorFromText = (text: string): number | null => {
  const cleaned = text.replace(/[,£$A\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Math.round(Number(cleaned) * 100);
  return value > 0 ? value : null;
};

/** A percentage typed on the ops page ("10" or "12.5") as basis points, or null when it is not one. */
export const bpsFromPercent = (text: string): number | null => {
  const value = Number(text.trim());
  if (text.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
};

export const percentOf = (bps: number): string => `${(bps / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}%`;
