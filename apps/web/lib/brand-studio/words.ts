/**
 * The words, limits and rule ids of Brand Studio (spec F-S9, plan v5 Y6, decision 0079). No zod
 * here, so a browser component can import them without shipping the schema library
 * (tests/architecture/client-weight.test.ts).
 *
 * Nothing in this file is a measurement or a licence. Where a rule explains a finding, the id is
 * one of `docs/spec/articles/JSY-SS-01/rulebook.md`; where the rulebook has no entry the id is
 * `R-GAP-000`, as the plan requires.
 */

export const BRAND_KINDS = ["club", "brand"] as const;
export type BrandKind = (typeof BRAND_KINDS)[number];

export const KIND_LABELS: Readonly<Record<BrandKind, string>> = { club: "Club", brand: "Brand" };

/** The spec's five categories, in the spec's order. */
export const BRAND_CATEGORIES = ["club", "sportswear_brand", "gym", "esports_team", "school"] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

export const CATEGORY_LABELS: Readonly<Record<BrandCategory, string>> = {
  club: "Club",
  sportswear_brand: "Sportswear brand",
  gym: "Gym",
  esports_team: "Esports team",
  school: "School",
};

/** Which categories count as a club: the kind follows the category, so the two can never disagree. */
export const kindOf = (category: BrandCategory): BrandKind =>
  category === "club" || category === "school" ? "club" : "brand";

/** The spec's font roles, in the spec's order. "Name & number" is the kit font. */
export const FONT_ROLES = ["headline", "subheadline", "body", "accent", "name_number"] as const;
export type FontRole = (typeof FONT_ROLES)[number];

export const FONT_ROLE_LABELS: Readonly<Record<FontRole, string>> = {
  headline: "Headline",
  subheadline: "Subheadline",
  body: "Body",
  accent: "Accent",
  name_number: "Name & number",
};

/** What an uploaded picture is used for in Brand Studio. The Sportswear tab owns the last four. */
export const ASSET_KINDS = ["logo", "graphic", "crest", "sponsor", "label", "packaging"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABELS: Readonly<Record<AssetKind, string>> = {
  logo: "Logo",
  graphic: "Graphic",
  crest: "Crest",
  sponsor: "Sponsor logo",
  label: "Label artwork",
  packaging: "Packaging",
};

/** The brand page's tabs, in the spec's order. */
export const BRAND_TABS = ["overview", "logos", "colours", "fonts", "graphics", "style", "sportswear"] as const;
export type BrandTabName = (typeof BRAND_TABS)[number];

export const TAB_LABELS: Readonly<Record<BrandTabName, string>> = {
  overview: "Overview",
  logos: "Logos",
  colours: "Colours",
  fonts: "Fonts",
  graphics: "Graphics",
  style: "Visual style",
  sportswear: "Sportswear",
};

/** The voice and tone tags the spec names. A brand picks from these; it does not type its own. */
export const VOICE_TAGS = ["bold", "gritty", "community", "premium", "playful"] as const;
export type VoiceTag = (typeof VOICE_TAGS)[number];

export const VOICE_TAG_LABELS: Readonly<Record<VoiceTag, string>> = {
  bold: "Bold",
  gritty: "Gritty",
  community: "Community",
  premium: "Premium",
  playful: "Playful",
};

/** The three visual-style texts of F-S9. Typed by hand for now; L7 writes them from reference images. */
export const STYLE_FIELDS = ["setting", "artDirection", "rulesBoundaries"] as const;
export type StyleField = (typeof STYLE_FIELDS)[number];

export const STYLE_LABELS: Readonly<Record<StyleField, string>> = {
  setting: "Setting",
  artDirection: "Art direction",
  rulesBoundaries: "Rules & boundaries",
};

export const STYLE_HINTS: Readonly<Record<StyleField, string>> = {
  setting: "Where your pictures are taken: the place, the weather, the time of day.",
  artDirection: "How they look: the lens, the light, the mood, the colour grade.",
  rulesBoundaries: "What must never appear, and what must always appear.",
};

/** Limits the database enforces too. A screen that shows a different number would be lying. */
export const LIMITS = {
  about: 1000,
  website: 200,
  paletteName: 60,
  colourName: 60,
  pantone: 40,
  assetLabel: 80,
  sponsorName: 40,
  styleText: 1000,
  palettesPerBrand: 12,
  coloursPerPalette: 24,
  /** Per kind. The club kit already allows three sponsors (decision 0042); the rest are Knitwright's own. */
  assetsPerKind: { logo: 12, graphic: 60, crest: 1, sponsor: 3, label: 6, packaging: 6 } as Readonly<Record<AssetKind, number>>,
} as const;

/**
 * The rules behind the findings Brand Studio shows.
 *
 * `R-SUB-003` and `R-SUB-005` are real entries of `docs/spec/articles/JSY-SS-01/rulebook.md`.
 * `R-GAP-000` stands where the rulebook has no entry: the sublimation GAMUT. The rulebook says a
 * colour is checked against a printed strike-off (R-SUB-005); it says nothing about which colours a
 * press can reach, and the platform holds no ICC profile, so the gamut estimate claims no rule.
 */
export const RULES = {
  /** "150 DPI at 1:1, sRGB, not mirrored", and vector logos where possible. */
  printResolution: "R-SUB-003",
  /** "Colours are checked against a printed strike-off; tolerance delta-E CMC(2:1) <= 1.5." */
  colourStrikeOff: "R-SUB-005",
  /** No rulebook entry for the printable gamut. Listed as a gap on the Y6 pull request. */
  gamutEstimate: "R-GAP-000",
} as const;

/** A finding Brand Studio shows about a colour or a picture. Every one carries the rule that explains it. */
export interface BrandFinding {
  readonly code: "gamut-estimate" | "screen-colour" | "sponsor-dpi" | "sponsor-raster";
  readonly severity: "warning" | "note";
  readonly ruleId: string;
  readonly subject: string;
  readonly message: string;
  readonly fix: string;
}
