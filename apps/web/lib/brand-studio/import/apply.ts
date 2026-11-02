/**
 * What an accepted import asks Brand Studio to save — in Y6's own shapes, through Y6's own
 * functions, into Y6's own tables.
 *
 * This workstream adds **no table and no migration**. An imported palette is a `brand_palettes`
 * row like any other; an imported font is a `brand_fonts` row; the three texts are the three
 * columns of `brand_profiles` a person could have typed; an accepted picture becomes one of the
 * brand's own uploads and then a `brand_assets` row. So an imported brand and a typed brand are
 * the same brand afterwards, and nothing in the database records that a machine filled it in.
 *
 * What is **not** here is as deliberate as what is. No page, no markup, no third-party picture, no
 * font file, no Pantone code, no measurement, and no panel layer: an import can reach the brand
 * record and the brand's own uploads, and nothing else in the platform.
 */

import type { BrandProfile } from "../types";
import type { FontsBody, PaletteBody, ProfileBody } from "../schemas";
import { STYLE_FIELDS } from "../words";
import { acceptedIds, uploadsFor } from "./decisions";
import { itemId } from "./items";
import { IMPORTED_PALETTE_NAME } from "./palette";
import type { ImportProposal, ImportedStyle, UploadIntent } from "./types";

/** Everything one accepted import would write, in the shapes `lib/brand-studio/service.ts` takes. */
export interface ImportPlan {
  /** The brand's details with the imported texts laid over them, or null when nothing changed. */
  readonly profile: ProfileBody | null;
  readonly palette: PaletteBody | null;
  readonly fonts: FontsBody | null;
  /** The pictures to fetch once more and store as the brand's own. Empty without the rights tick. */
  readonly uploads: readonly UploadIntent[];
}

/** The colours the person kept, in the order they were found, as the palette schema takes them. */
const colourRows = (proposal: ImportProposal): PaletteBody["colours"] => {
  const kept = acceptedIds(proposal, "colour");
  return proposal.colours
    .filter((colour) => kept.has(itemId("colour", colour.hex)))
    // The page gave no name and no Pantone code, so neither is invented: a person names them.
    .map((colour) => ({ name: "", hex: colour.hex, pantoneTcx: null }));
};

/** The roles the person kept that have a font Knitwright may use. A role left out is not touched. */
const fontRows = (proposal: ImportProposal): FontsBody["fonts"] => {
  const kept = acceptedIds(proposal, "font");
  return proposal.fonts
    .filter((font) => font.fontKey !== null && kept.has(itemId("font", font.role)))
    .map((font) => ({ role: font.role, fontKey: font.fontKey }));
};

/** The three texts, when the person kept them. Null when they did not, or when none were written. */
export const acceptedStyle = (proposal: ImportProposal): ImportedStyle | null => {
  if (proposal.style === null) return null;
  return acceptedIds(proposal, "style").has(itemId("style", "all")) ? proposal.style : null;
};

/**
 * The brand's details with the import laid over them: the three texts when they were kept, and the
 * site that was imported as the website when the brand had none. Everything else the brand said
 * about itself is carried over untouched, because an import is not allowed to forget it.
 */
export function profileFor(current: BrandProfile, proposal: ImportProposal): ProfileBody | null {
  const style = acceptedStyle(proposal);
  const website = current.website ?? proposal.url;
  if (style === null && website === current.website) return null;
  const texts = Object.fromEntries(STYLE_FIELDS.map((field) => [field, style === null ? current.style[field] : style[field]]));
  return {
    category: current.category,
    website,
    about: current.about,
    voiceTags: [...current.voiceTags],
    defaultSizeRange: [...current.defaultSizeRange],
    ...texts,
  } as ProfileBody;
}

/**
 * Everything one accepted import would write. Nothing is written here: this builds the bodies and
 * the caller passes them to `saveProfile`, `savePalette`, `saveFonts` and the storage layer, each
 * of which checks the person's role itself.
 */
export function planOf(proposal: ImportProposal, current: BrandProfile, userId: string, now: Date): ImportPlan {
  const colours = colourRows(proposal);
  const fonts = fontRows(proposal);
  return {
    profile: profileFor(current, proposal),
    palette: colours.length === 0 ? null : { paletteId: null, name: IMPORTED_PALETTE_NAME, colours },
    fonts: fonts.length === 0 ? null : { fonts },
    uploads: uploadsFor(proposal, userId, now),
  };
}

/** True when an accepted import would change nothing, so the screen can say so rather than save. */
export const changesNothing = (plan: ImportPlan): boolean =>
  plan.profile === null && plan.palette === null && plan.fonts === null && plan.uploads.length === 0;
