import { LETTERING_LABELS, LETTERING_STYLES } from "@/lib/garment";

/**
 * The font list for player names and numbers (spec F-S4 "pick the font from the licensed list",
 * plan v5 Y8, decision 0081).
 *
 * **Knitwright has licensed no kit-font kit.** The only font this repository holds a licence for is
 * Geist, under the SIL Open Font License 1.1, which ships in `assets/fonts` and is what the flats,
 * the PDF and the print files already letter in (`lib/flat/pdf-font.ts`, `lib/print/text/outline.ts`).
 * So the list below has one licensed font and three clearly labelled placeholders: the three other
 * lettering styles of decision 0027, each of which is a written instruction to the factory, drawn
 * in the bundled font, with no claim that any file for it is licensed.
 *
 * Nothing here ever says a font is licensed when that is unknown. The owner question in decision
 * 0081 asks which kit fonts to license; until it is answered the panel shows this list and labels
 * it as a placeholder.
 */

export const LICENCE_STATES = ["licensed", "no-file-yet"] as const;
export type LicenceState = (typeof LICENCE_STATES)[number];

export interface KitFont {
  readonly id: string;
  readonly name: string;
  /**
   * The lettering style the design stores (decision 0027). The spec's font list and the four
   * stored styles are the same choice, so picking a font needs no change to the saved design.
   */
  readonly style: (typeof LETTERING_STYLES)[number];
  readonly licence: LicenceState;
  /** What is known about the licence, in full. Never shortened to "licensed". */
  readonly licenceNote: string;
}

/** Said above the list, so nobody reads it as a licensed kit-font kit. */
export const FONT_LIST_LABEL =
  "Placeholder list, not a licensed kit-font kit. One font ships with Knitwright under an open licence; the other three are styles we write to the factory, and no font file for them is licensed yet.";

const OFL = "SIL Open Font License 1.1. The file ships with Knitwright and is what the drawings and the print files letter in.";
const NO_FILE =
  "No font file for this style is licensed yet. The style goes to the factory as a written instruction, and the drawings letter in the font that ships with Knitwright.";

export const KIT_FONTS: readonly KitFont[] = [
  { id: "geist-block", name: `${LETTERING_LABELS.block} (Geist)`, style: "block", licence: "licensed", licenceNote: OFL },
  { id: "varsity", name: LETTERING_LABELS.varsity, style: "varsity", licence: "no-file-yet", licenceNote: NO_FILE },
  { id: "rounded", name: LETTERING_LABELS.rounded, style: "rounded", licence: "no-file-yet", licenceNote: NO_FILE },
  { id: "italic", name: LETTERING_LABELS.italic, style: "italic", licence: "no-file-yet", licenceNote: NO_FILE },
];

/** What a tile says under the font's name. */
export const LICENCE_WORDS: Readonly<Record<LicenceState, string>> = {
  licensed: "Ships with Knitwright",
  "no-file-yet": "No font file yet",
};

/** The font of a stored lettering style, or null while no style has been chosen. */
export const fontForStyle = (style: string): KitFont | null => KIT_FONTS.find((font) => font.style === style) ?? null;

/** True when every lettering style the design can store has a font in the list, so none is unreachable. */
export const everyStyleListed = (): boolean => LETTERING_STYLES.every((style) => KIT_FONTS.some((font) => font.style === style));
