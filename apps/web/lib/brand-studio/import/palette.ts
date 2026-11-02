/**
 * The palette one import proposes (spec F-S9 "colour palettes").
 *
 * **No colour value is invented.** Every `#rrggbb` here is one the page itself stated, in a
 * stylesheet or in a picture of the brand's own, and the only arithmetic applied to it is
 * `lib/colour`'s own: CIE Lab in the platform's published convention — D65 white point, 2 degree
 * observer, owner decision 15 — because no print house has stated its own white point or observer
 * to us. Two colours are the same colour when the CIE76 difference between them is under the
 * allowance in `settings.ts`, and the sublimation answer is `nearestSublimationSafe`'s, which is
 * Knitwright's own estimate with no ICC profile behind it and says so in its own sentence.
 *
 * No Pantone code is ever worked out: no Pantone data ships, so `pantoneTcx` is null on every
 * imported colour and a person types their own from a printed swatch book.
 */

import { deltaE } from "@/lib/colour/convert";
import { nearestSublimationSafe } from "@/lib/colour/palette";
import type { BrandImportSettings } from "./settings";
import type { ImportNote, ImportedColour, PictureFacts } from "./types";
import { RULES } from "./words";

/** A colour before it is weighed against the others: the hex, where it came from, and how much of it. */
type Seen = Readonly<{ hex: string; from: string; share: number | null; weight: number }>;

/** Pure RGB black. The rulebook has its own advice about it (R-SUB-008). */
const PURE_BLACK = "#000000";

/** Colours a page uses for text and paper rather than for a brand. Neither is a brand colour. */
const isPaper = (hex: string): boolean => hex === "#ffffff" || hex === "#fefefe";

const screenOnly = (hex: string): ImportNote => ({
  ruleId: RULES.colourStrikeOff,
  severity: "note",
  message: `${hex} is a screen colour read off your own page, with no Pantone TCX code, so a factory has nothing to match to yet. Add the code from your printed swatch book.`,
});

const richBlack = (): ImportNote => ({
  ruleId: RULES.richBlack,
  severity: "note",
  message: "Your page uses pure RGB black. On a sublimation press the factory's own black recipe prints better, so pick the kit black rather than this one.",
});

/** The estimate's own sentence, word for word, so this file states nothing of its own about a press. */
const gamut = (warning: string): ImportNote => ({ ruleId: RULES.gamutEstimate, severity: "warning", message: warning });

/** Where a colour came from, in the words a person reads on the row. */
const fromStyles = (at: number): string => `Your page's own styles, colour ${at + 1}`;
const fromPicture = (facts: PictureFacts): string => `Your ${facts.why === "img-logo" || facts.why === "favicon" ? "logo" : "picture"} ${facts.url.split("/").pop() ?? ""}`.trim();

/**
 * Every colour the page stated, heaviest first. A stylesheet colour is weighed by how early the
 * page names it, because a page names its brand colours before its greys; a picture's colour is
 * weighed by how much of the picture holds it.
 */
export function seenColours(cssColours: readonly string[], pictures: readonly PictureFacts[]): readonly Seen[] {
  const fromCss = cssColours.map((hex, at) => ({ hex, from: fromStyles(at), share: null, weight: (cssColours.length - at) / cssColours.length }));
  const fromPictures = pictures.flatMap((facts) =>
    facts.swatches.map((swatch) => ({ hex: swatch.hex, from: fromPicture(facts), share: swatch.share, weight: swatch.share })),
  );
  return [...fromCss, ...fromPictures].filter((one) => !isPaper(one.hex)).sort((a, b) => b.weight - a.weight || a.hex.localeCompare(b.hex));
}

/** The first of each group of colours too close to tell apart, in weight order. */
export function distinct(seen: readonly Seen[], gap: number): readonly Seen[] {
  const kept: Seen[] = [];
  for (const one of seen) {
    if (kept.some((already) => deltaE(already.hex, one.hex) < gap)) continue;
    kept.push(one);
  }
  return kept;
}

/** One colour with the sublimation estimate's answer and the notes that explain it. */
export function colourOf(one: Seen): ImportedColour {
  const match = nearestSublimationSafe(one.hex);
  return {
    hex: match.hex,
    safeHex: match.safeHex,
    inGamut: match.inGamut,
    deltaE: Math.round(match.deltaE * 100) / 100,
    from: one.from,
    share: one.share,
    pantoneTcx: null,
    notes: [
      ...(match.inGamut ? [] : [gamut(match.warning)]),
      ...(match.hex === PURE_BLACK ? [richBlack()] : []),
      screenOnly(match.hex),
    ],
  };
}

/**
 * The palette an import proposes: the page's own colours, the near-duplicates folded together, the
 * heaviest first, as many as the allowance says.
 */
export const proposedColours = (
  cssColours: readonly string[],
  pictures: readonly PictureFacts[],
  settings: BrandImportSettings,
): readonly ImportedColour[] => distinct(seenColours(cssColours, pictures), settings.colourGap).slice(0, settings.colours).map(colourOf);

/** The name an imported palette is offered under. A person renames it before saving. */
export const IMPORTED_PALETTE_NAME = "From your site";
