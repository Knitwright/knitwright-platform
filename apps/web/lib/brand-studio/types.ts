/**
 * The shapes Brand Studio reads and writes (spec F-S9, decision 0079). No zod here, so the browser
 * components can import them (tests/architecture/client-weight.test.ts). The schemas that parse
 * these shapes live in `schemas.ts`, which only the server imports.
 */

import type { AssetKind, BrandCategory, BrandFinding, BrandKind, FontRole, StyleField, VoiceTag } from "./words";

/** The details and visual style of a brand. Every text is the brand's own; nothing is guessed. */
export interface BrandProfile {
  readonly kind: BrandKind;
  readonly category: BrandCategory;
  /** `https://…`, or null when none was given. */
  readonly website: string | null;
  readonly about: string;
  readonly voiceTags: readonly VoiceTag[];
  /** The three F-S9 texts. Empty means "Needs your input", never a guess. */
  readonly style: Readonly<Record<StyleField, string>>;
  /** Size labels this brand makes by default, e.g. `["S", "M", "L"]`. Empty until the brand says. */
  readonly defaultSizeRange: readonly string[];
}

/** A brand that has saved nothing yet. A category nobody chose is `brand`, the neutral of the two kinds. */
export const EMPTY_PROFILE: BrandProfile = {
  kind: "brand",
  category: "sportswear_brand",
  website: null,
  about: "",
  voiceTags: [],
  style: { setting: "", artDirection: "", rulesBoundaries: "" },
  defaultSizeRange: [],
};

/** One colour of a named palette, as the brand typed it. */
export interface BrandColour {
  readonly id: string;
  readonly name: string;
  /** `#rrggbb`, lower case. The screen colour, never a factory reference. */
  readonly hex: string;
  /** The brand's own Pantone TCX code, typed by hand. Null when none was given: no Pantone data ships. */
  readonly pantoneTcx: string | null;
}

/**
 * Where a palette or a picture came from. `club-kit` means it is read through from `club_kits`
 * (decision 0042) and is still edited on `/club`: Brand Studio shows it but never writes it, so the
 * club kit stays the one place that holds it and nothing can be lost to a copy that drifted.
 */
export type BrandSource = "brand-studio" | "club-kit";

export interface BrandPalette {
  readonly id: string;
  readonly name: string;
  readonly colours: readonly BrandColour[];
  readonly source: BrandSource;
}

/** A font chosen for one role, with the licence the repository can show for it. */
export interface FontChoice {
  readonly role: FontRole;
  readonly fontKey: string | null;
}

/** One row of the licensed kit-font list, as the platform holds it. */
export interface KitFont {
  readonly key: string;
  readonly label: string;
  readonly family: string;
  /** `bundled`: the licence file is in the repository. `not_established`: no licence is on file. */
  readonly licence: "bundled" | "not_established";
  /** Word for word, what the repository can show. Shown beside the font. */
  readonly licenceNote: string;
  /** Only a font whose licence is on file may be chosen. */
  readonly selectable: boolean;
}

/** A logo, graphic, crest, sponsor logo, label or packaging picture, taken from the brand's own uploads. */
export interface BrandAsset {
  readonly id: string;
  readonly kind: AssetKind;
  /** A `user_artworks` id when the source is `brand-studio`, a `files` id when it is `club-kit`. */
  readonly artworkId: string;
  readonly label: string;
  /** The sponsor's name, for a sponsor logo. Null for every other kind. */
  readonly sponsorName: string | null;
  /** The width the brand wants it printed at, in millimetres, or null when it has not said. */
  readonly printWidthMm: number | null;
  readonly source: BrandSource;
}

/** What the brand's uploads say about one picture, for the DPI check of F-S9's Sportswear tab. */
export interface ArtworkFacts {
  readonly artworkId: string;
  readonly label: string;
  readonly kind: "raster" | "vector";
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Everything one brand's Brand Studio shows. */
export interface BrandRecord {
  readonly brandId: string;
  readonly brandName: string;
  readonly profile: BrandProfile;
  readonly palettes: readonly BrandPalette[];
  readonly fonts: readonly FontChoice[];
  readonly assets: readonly BrandAsset[];
}

/** A colour with what the sublimation estimate says about it. Built on the server; shown by `<BrandTab>`. */
export interface ColourView extends BrandColour {
  readonly paletteId: string;
  readonly paletteName: string;
  /** The nearest colour the estimate accepts. Equal to `hex` when the colour is already inside. */
  readonly safeHex: string;
  readonly inGamut: boolean;
  /** CIE76 difference between `hex` and `safeHex`. 0 when nothing changed. */
  readonly deltaE: number;
  readonly findings: readonly BrandFinding[];
}

export type { AssetKind, BrandCategory, BrandFinding, BrandKind, FontRole, StyleField, VoiceTag };
