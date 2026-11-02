/**
 * "Fonts (closest licensed match)" of F-S9, read honestly.
 *
 * **No font file is ever fetched, embedded or committed.** An import reads the *names* of the
 * families a page asks for — out of its own `font-family` rules and the address of any web-font
 * stylesheet it loads — and then matches those names against the rows of `brand_studio_fonts`,
 * which is the list of fonts whose licence is in this repository. Y6's decision 0079 put the rule
 * in the database itself (`check (selectable = (licence = 'bundled'))`), and today only the two
 * bundled Geist faces pass it; the four other rows are labelled placeholders that cannot be chosen.
 *
 * So the honest answer is usually "this is the nearest font Knitwright may use, and it is **not**
 * your font", and that is what every row says. Nothing here implies a licence Knitwright does not
 * hold, and nothing here is a measurement: the way a family name is sorted into a kind is
 * Knitwright's own reading of the words in the name, labelled as a draft.
 */

import type { KitFont } from "../types";
import { FONT_ROLES, type FontRole } from "../words";
import type { ImportNote, ImportedFont } from "./types";
import { DRAFT_LABEL, FONT_LICENCE_ASK, RULES } from "./words";

/** The kinds of face this tells apart, most particular first: the first match wins. */
export const FACE_KINDS = ["mono", "stencil", "condensed", "display", "serif", "sans"] as const;
export type FaceKind = (typeof FACE_KINDS)[number];

/** The words that put a name in a kind. Knitwright's own reading of type names, not a standard. */
const KIND_WORDS: Readonly<Record<FaceKind, RegExp>> = {
  mono: /\b(mono|monospace|code|courier|consolas|menlo)\b/i,
  stencil: /\b(stencil|military|army|marine)\b/i,
  condensed: /\b(condensed|narrow|compressed|cond)\b/i,
  display: /\b(display|block|black|heavy|ultra|impact|poster|headline|titling|bebas|anton|oswald|teko|druk)\b/i,
  serif: /\b(serif|slab|times|georgia|garamond|playfair|merriweather|didot|bodoni|editorial)\b/i,
  sans: /\b(sans|grotesk|grotesque|gothic|helvetica|inter|geist|neue)\b/i,
};

export const KIND_SOURCE = `${DRAFT_LABEL}: a family's kind is read from the words in its name.`;

/** Which kind of face a name reads as. A name that says nothing is taken as a sans. */
export const kindOf = (name: string): FaceKind => FACE_KINDS.find((kind) => KIND_WORDS[kind].test(name)) ?? "sans";

/** A name with only its letters and digits, lower case, so "Geist Sans" and "geist-sans" match. */
const plainName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Only a row whose licence is in this repository may be offered. The database holds the same rule. */
const usable = (fonts: readonly KitFont[]): readonly KitFont[] => fonts.filter((font) => font.selectable);

/** The row a name *is*, when the page's own family happens to be one Knitwright may use. */
const sameFont = (name: string, fonts: readonly KitFont[]): KitFont | undefined =>
  usable(fonts).find((font) => [font.key, font.label, font.family].some((said) => plainName(said) === plainName(name)));

/** The nearest row Knitwright may use: one of the same kind when there is one, else the first of all. */
export function nearestUsable(name: string, fonts: readonly KitFont[]): Readonly<{ font: KitFont | null; sameKind: boolean }> {
  const may = usable(fonts);
  const wanted = kindOf(name);
  const ofKind = may.find((font) => kindOf(`${font.label} ${font.key}`) === wanted);
  if (ofKind) return { font: ofKind, sameKind: true };
  return { font: may[0] ?? null, sameKind: false };
}

const notUsable = (): ImportNote => ({ ruleId: RULES.fontLicence, severity: "warning", message: FONT_LICENCE_ASK });

const notYourFont = (font: KitFont, wanted: string, sameKind: boolean): ImportNote => ({
  ruleId: RULES.fontLicence,
  severity: "warning",
  message: sameKind
    ? `${font.label} is the nearest font Knitwright may use. It is not ${wanted}, and it will not look the same. ${font.licenceNote}`
    : `${font.label} is the only kind of font Knitwright may use here, and it is a different kind of face from ${wanted}. ${font.licenceNote}`,
});

const kitFontGap = (): ImportNote => ({
  ruleId: RULES.fontLicence,
  severity: "warning",
  message: "No kit font's licence is on file, so names and numbers cannot be set in one yet. Your page cannot tell us which kit font you use either.",
});

const fineDetail = (): ImportNote => ({
  ruleId: RULES.fineDetail,
  severity: "note",
  message: "A name and number is printed, not drawn on a screen: the rulebook asks for a minimum line of 0.5 mm, so a hairline face reads poorly on knit fabric.",
});

/** One role, with the nearest font Knitwright may use and the plain truth about the match. */
export function fontFor(role: FontRole, wanted: string | null, fonts: readonly KitFont[]): ImportedFont {
  const extra = role === "name_number" ? [fineDetail()] : [];
  if (wanted === null) {
    const note = role === "name_number" ? kitFontGap() : notUsable();
    return { role, wanted: null, fontKey: null, fontLabel: null, isSameFont: false, notes: [note, ...extra] };
  }
  const exact = sameFont(wanted, fonts);
  if (exact) return { role, wanted, fontKey: exact.key, fontLabel: exact.label, isSameFont: true, notes: extra };
  const near = nearestUsable(wanted, fonts);
  if (near.font === null) return { role, wanted, fontKey: null, fontLabel: null, isSameFont: false, notes: [notUsable(), ...extra] };
  return { role, wanted, fontKey: near.font.key, fontLabel: near.font.label, isSameFont: false, notes: [notYourFont(near.font, wanted, near.sameKind), ...extra] };
}

/**
 * Which of the page's families is offered for which role. A page names its families in the order it
 * uses them, so the first is offered as the headline and the next as the body; a page that names one
 * family gets that one everywhere. **Name & number is never guessed from a web page**: F-S9 takes it
 * from the kit-font list, and no row of that list has a licence on file yet.
 */
export const roleWants = (families: readonly string[]): Readonly<Record<FontRole, string | null>> => ({
  headline: families[0] ?? null,
  subheadline: families[1] ?? families[0] ?? null,
  body: families[1] ?? families[0] ?? null,
  accent: families[2] ?? families[0] ?? null,
  name_number: null,
});

/** The five roles of F-S9, each with the nearest font Knitwright may use for it. */
export const proposedFonts = (families: readonly string[], fonts: readonly KitFont[]): readonly ImportedFont[] => {
  const wants = roleWants(families);
  return FONT_ROLES.map((role) => fontFor(role, wants[role], fonts));
};

/** How a font is described on its row. */
export const fontDetail = (font: ImportedFont): string => {
  if (font.fontLabel === null) return font.wanted === null ? "Nothing to match" : `${font.wanted} · nothing Knitwright may use`;
  if (font.isSameFont) return `${font.fontLabel} · your own font`;
  return `${font.fontLabel} · nearest to ${font.wanted}`;
};
