/**
 * What Brand Studio says about a brand colour (spec F-S9 Colours): its hex, the Pantone TCX the
 * brand typed, and the nearest sublimation-safe match with a gamut warning.
 *
 * The warning is computed, not guessed: `lib/colour/palette.ts` works in CIE Lab through
 * `lib/print/rules/colour` (D65, 2 degree, owner decision 15) against the estimated gamut of
 * `lib/guardrails/gamut.ts`. The estimate has no ICC profile behind it, so every sentence says so
 * and the finding carries `R-GAP-000`: the rulebook has no entry for a printable gamut.
 *
 * No Pantone data ships (open item P6), so nothing here ever works out a Pantone code. A colour with
 * no code has none.
 */

import { nearestSublimationSafe } from "@/lib/colour/palette";
import type { BrandColour, BrandPalette, ColourView } from "./types";
import { RULES, type BrandFinding } from "./words";

/** What a colour is called in a sentence: its name, or its hex when it has no name. */
const nameOf = (colour: BrandColour): string => (colour.name.trim() === "" ? colour.hex : colour.name.trim());

/** The warning for a colour the sublimation estimate refuses, or nothing. Never a blocker. */
const gamutFinding = (colour: BrandColour, safeHex: string, warning: string): BrandFinding => ({
  code: "gamut-estimate",
  severity: "warning",
  ruleId: RULES.gamutEstimate,
  subject: nameOf(colour),
  message: warning,
  fix: `Ask your print house for a printed swatch, or use ${safeHex}, the nearest colour the estimate accepts.`,
});

/** Said about every colour that carries no Pantone TCX code. A screen colour is not a factory reference. */
const screenOnlyFinding = (colour: BrandColour): BrandFinding => ({
  code: "screen-colour",
  severity: "note",
  ruleId: RULES.colourStrikeOff,
  subject: nameOf(colour),
  message: `${nameOf(colour)} has a screen colour but no Pantone TCX code, so a factory has nothing to match to.`,
  fix: "Add the Pantone TCX code from your printed swatch book, or ask the factory for a strike-off and record what they send.",
});

/** One colour with the estimate's answer and the findings that explain it. */
export function colourView(palette: Readonly<{ id: string; name: string }>, colour: BrandColour): ColourView {
  const match = nearestSublimationSafe(colour.hex);
  const findings = [
    ...(match.inGamut ? [] : [gamutFinding(colour, match.safeHex, match.warning)]),
    ...(colour.pantoneTcx === null ? [screenOnlyFinding(colour)] : []),
  ];
  return {
    ...colour,
    hex: match.hex,
    paletteId: palette.id,
    paletteName: palette.name,
    safeHex: match.safeHex,
    inGamut: match.inGamut,
    deltaE: Math.round(match.deltaE * 100) / 100,
    findings,
  };
}

/** Every colour of every palette, in palette order, each with the estimate's answer. */
export const colourViews = (palettes: readonly BrandPalette[]): readonly ColourView[] =>
  palettes.flatMap((palette) => palette.colours.map((colour) => colourView(palette, colour)));

/** Every finding about a colour, for the Overview tab and the Review list. */
export const colourFindings = (palettes: readonly BrandPalette[]): readonly BrandFinding[] =>
  colourViews(palettes).flatMap((view) => view.findings);
