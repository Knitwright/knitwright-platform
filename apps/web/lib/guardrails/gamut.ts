import { HEX, toLab } from "@/lib/print/rules/colour";
import type { Finding, UsedColour } from "./types";

/**
 * AN APPROXIMATION, NOT A MEASUREMENT. Knitwright has no ICC profile for any print house, so the real sublimation
 * gamut is unknown. This estimate flags only the most saturated sRGB colours, using two limits that are Knitwright's
 * own rough guesses (not measured from any printer or ink): chroma above 80 anywhere, and chroma above 65 for hues
 * from green through blue (140 to 290 degrees), where print gamuts are usually tighter than sRGB. A colour not flagged
 * may still print differently; a colour flagged may print fine.
 */
export const APPROX_GAMUT = { maxChroma: 80, maxChromaGreenBlue: 65, greenBlueHue: [140, 290] as const };

export function isInsideApproxGamut(hex: string): boolean {
  if (!HEX.test(hex)) return true;
  const [, a, b] = toLab(hex);
  const chroma = Math.hypot(a, b);
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const [from, to] = APPROX_GAMUT.greenBlueHue;
  const limit = hue >= from && hue <= to ? APPROX_GAMUT.maxChromaGreenBlue : APPROX_GAMUT.maxChroma;
  return chroma <= limit;
}

export const GAMUT_NOTE =
  "This is a rough estimate, not a colour match. The true range needs your print house's ICC profile, which Knitwright does not have.";

/** One warning per colour that falls outside the estimate. Never a blocker. */
export function gamutCheck(colours: readonly UsedColour[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const colour of colours) {
    const key = colour.hex.toLowerCase();
    if (seen.has(key) || isInsideApproxGamut(colour.hex)) continue;
    seen.add(key);
    out.push({
      code: "gamut-approx",
      check: "gamut",
      severity: "warning",
      panel: null,
      itemId: colour.id,
      locationMm: null,
      message: `${colour.label} (${colour.hex}) is very saturated and may print duller on fabric. ${GAMUT_NOTE}`,
      fix: "Ask your print house for a printed swatch of this colour, or pick a less saturated one.",
    });
  }
  return out;
}
