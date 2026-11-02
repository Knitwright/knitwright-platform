import { toLab } from "@/lib/colour/convert";
import { extractPalette, GAMUT_ESTIMATE_NOTE, nearestSublimationSafe, type Pixels, type Swatch } from "@/lib/colour/palette";
import { CLUB_PALETTE } from "@/lib/kit-styles/presets";
import { deltaE2000 } from "@/lib/media-check/ciede2000";
import { CREST_LIMITS, RULES } from "./settings";

/**
 * The palette of a crest (spec F-T2 step 2), read through the SHARED `lib/colour/palette.ts` so
 * Brand Studio (Y6, decision 0079) and crest-to-kit can never disagree about a crest's colours.
 * Nothing is extracted here: this file snaps each shared swatch to the sublimation estimate and
 * pairs it with the nearest colour Knitwright actually holds a figure for.
 *
 * EVERY NUMBER HERE HAS A PUBLISHED BASIS. The swatches are the shared k-means in CIE Lab. The
 * gamut is `lib/guardrails/gamut.ts`'s own estimate, which has no ICC profile behind it
 * (`GAMUT_ESTIMATE_NOTE`). Every difference is CIEDE2000 from `lib/media-check/ciede2000.ts`
 * (Sharma, Wu and Dalal, 2005) over Lab from `lib/colour/convert.ts`, which is sRGB with a D65
 * white point and the 2-degree observer (owner decision 15). Nothing is measured from a printer,
 * and nothing is stated as a colour match.
 *
 * THERE IS NO PANTONE DATA IN THIS REPOSITORY. Pantone's colour values are licensed and the
 * platform ships none (open item P6), so "the nearest Pantone" cannot be answered. A nearest
 * colour is given from a named list Knitwright owns, every answer says which list it came from,
 * and `PANTONE_GAP` says plainly that it is not a Pantone match. The pull request asks the owner
 * for a licensed book.
 */

/** Said wherever a nearest colour is shown. It never claims a Pantone match. */
export const PANTONE_GAP =
  "Knitwright holds no Pantone colour values: they are licensed and none ships with the platform, so no Pantone number can be given here. The nearest colour below comes from Knitwright's own named list.";

/** The basis of every difference figure on this screen, said once beside them. */
export const DELTA_BASIS =
  "Differences are CIEDE2000 worked out from screen colours as sRGB with a D65 white point and the 2-degree observer. They are not a measurement of printed fabric.";

/** One entry of a colour reference: a name, the screen colour it stands for, and whose list it is. */
export interface ReferenceColour {
  readonly name: string;
  readonly hex: string;
  /** Which list the name belongs to, so no screen can read it as another system's code. */
  readonly system: string;
}

/** A colour reference Knitwright can look a colour up in. Empty is a valid book, and says so. */
export type ReferenceBook = readonly ReferenceColour[];

/** The list Knitwright owns: the club colours of `lib/kit-styles/presets.ts`, named for the screen only. */
export const KNITWRIGHT_NAMED_COLOURS: ReferenceBook = CLUB_PALETTE.map((entry) => ({
  name: entry.name,
  hex: entry.swatch,
  system: "Knitwright named colours",
}));

/** The nearest entry of a book, with how far away it is. */
export interface ReferenceMatch {
  readonly name: string;
  readonly hex: string;
  readonly system: string;
  /** CIEDE2000 between the colour asked about and this entry. */
  readonly deltaE00: number;
}

/** The nearest colour in a book, or null when the book is empty. */
export function nearestReference(hex: string, book: ReferenceBook = KNITWRIGHT_NAMED_COLOURS): ReferenceMatch | null {
  const lab = toLab(hex);
  let best: ReferenceMatch | null = null;
  for (const entry of book) {
    const deltaE00 = deltaE2000(lab, toLab(entry.hex));
    if (best === null || deltaE00 < best.deltaE00) best = { name: entry.name, hex: entry.hex.toLowerCase(), system: entry.system, deltaE00 };
  }
  return best;
}

/** One colour of a crest, with what the sublimation estimate says and the nearest named colour. */
export interface CrestColour extends Swatch {
  /** The nearest colour the sublimation estimate accepts. The same colour when it already is. */
  readonly safeHex: string;
  readonly inGamut: boolean;
  /** CIEDE2000 between the colour and the estimated-safe one. Nought when nothing changed. */
  readonly deltaE00: number;
  /** The sentence to show where the estimate refuses the colour, else null. */
  readonly warning: string | null;
  readonly reference: ReferenceMatch | null;
  readonly ruleId: string;
}

const colourOf = (swatch: Swatch, book: ReferenceBook): CrestColour => {
  const match = nearestSublimationSafe(swatch.hex);
  return {
    ...swatch,
    safeHex: match.safeHex,
    inGamut: match.inGamut,
    deltaE00: deltaE2000(toLab(swatch.hex), toLab(match.safeHex)),
    warning: match.inGamut ? null : match.warning,
    reference: nearestReference(swatch.hex, book),
    ruleId: RULES.colourTolerance,
  };
};

/**
 * The palette of a decoded crest, dominant colour first. The pixels are a COPY the caller decoded;
 * the crest's own bytes are never touched. An empty or wholly transparent picture has no palette
 * and gives an empty list rather than a guess.
 */
export function crestColours(pixels: Pixels, book: ReferenceBook = KNITWRIGHT_NAMED_COLOURS): readonly CrestColour[] {
  return extractPalette(pixels, { colours: CREST_LIMITS.readColours }).map((swatch) => colourOf(swatch, book));
}

/**
 * The palette of colours a club picked itself (spec F-T2 step 1, "or pick up to 3 colours"). The
 * share is split evenly: nobody counted pixels, so no share is invented beyond "one of these".
 */
export function pickedColours(hexes: readonly string[], book: ReferenceBook = KNITWRIGHT_NAMED_COLOURS): readonly CrestColour[] {
  const taken = hexes.slice(0, CREST_LIMITS.maxPickedColours);
  return taken.map((hex) => colourOf({ hex: hex.toLowerCase(), share: 1 / taken.length }, book));
}

/** The colour a kit's main colour is matched against: the crest's dominant one, or null when there is none. */
export const dominantOf = (colours: readonly CrestColour[]): CrestColour | null => colours[0] ?? null;

/** How far a kit's main colour sits from the crest's dominant colour, in CIEDE2000. */
export const primaryDrift = (colours: readonly CrestColour[], mainHex: string): number | null => {
  const dominant = dominantOf(colours);
  return dominant === null ? null : deltaE2000(toLab(dominant.hex), toLab(mainHex));
};

/** Said where a colour the club picked is outside the estimate. The estimate's own words, once. */
export const GAMUT_NOTE = GAMUT_ESTIMATE_NOTE;
