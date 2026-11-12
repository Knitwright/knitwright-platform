import type { BrandRecord } from "./types";
import { FONT_ROLE_LABELS, FONT_ROLES, STYLE_FIELDS, VOICE_TAG_LABELS, type BrandTabName } from "./words";

/**
 * The six cards of the Brand page's Overview (08 §4.6, d17; decision 0144): each part with its count
 * pill and a one-line look at what is in it. Pure, so the counts are tested apart from the page.
 */

export interface OverviewCard {
  readonly tab: BrandTabName;
  readonly title: string;
  /** "3", "2 palettes", "Added", or null when there is nothing yet. */
  readonly pill: string | null;
  /** The swatches of the first palette, for the Colours card. */
  readonly swatches: readonly string[];
  /** Short words under the title: font roles, voice tags, the sportswear checks. */
  readonly chips: readonly string[];
  readonly line: string | null;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const SWATCHES_SHOWN = 6;

const ofKind = (record: BrandRecord, kinds: readonly string[]): number => record.assets.filter((asset) => kinds.includes(asset.kind)).length;

const card = (tab: BrandTabName, title: string, part: Partial<Omit<OverviewCard, "tab" | "title">>): OverviewCard => ({
  tab,
  title,
  pill: part.pill ?? null,
  swatches: part.swatches ?? [],
  chips: part.chips ?? [],
  line: part.line ?? null,
});

function sportswearLine(record: BrandRecord): string {
  const crest = ofKind(record, ["crest"]) > 0 ? "Crest ✓" : "No crest yet";
  const sponsors = ofKind(record, ["sponsor"]);
  const sizes = record.profile.defaultSizeRange;
  const range = sizes.length > 0 ? `${sizes[0]}–${sizes[sizes.length - 1]}` : "no default sizes";
  const label = ofKind(record, ["label"]) > 0 ? "care label ✓" : null;
  return [crest, sponsors > 0 ? plural(sponsors, "sponsor", "sponsors") : null, range, label].filter(Boolean).join(" · ");
}

export function overviewCards(record: BrandRecord): readonly OverviewCard[] {
  const logos = ofKind(record, ["logo"]);
  const graphics = ofKind(record, ["graphic"]);
  const fonts = FONT_ROLES.filter((role) => record.fonts.some((font) => font.role === role && font.fontKey !== null));
  const styleDone = STYLE_FIELDS.every((field) => record.profile.style[field].trim() !== "");
  const first = record.palettes.find((palette) => palette.colours.length > 0);
  return [
    card("logos", "Logos", { pill: logos > 0 ? String(logos) : null, line: logos > 0 ? null : "Add your logo from your uploads." }),
    card("colours", "Colours", {
      pill: record.palettes.length > 0 ? plural(record.palettes.length, "palette", "palettes") : null,
      swatches: first ? first.colours.slice(0, SWATCHES_SHOWN).map((colour) => colour.hex) : [],
      line: first ? null : "Add a palette.",
    }),
    card("fonts", "Fonts", {
      pill: fonts.length > 0 ? plural(fonts.length, "style", "styles") : null,
      chips: fonts.map((role) => FONT_ROLE_LABELS[role]),
      line: fonts.length > 0 ? null : "Choose a font for each role.",
    }),
    card("graphics", "Graphics", { pill: graphics > 0 ? String(graphics) : null, line: graphics > 0 ? null : "Patterns, marks and photographs." }),
    card("style", "Visual style", {
      pill: styleDone ? "Added" : null,
      chips: record.profile.voiceTags.map((tag) => VOICE_TAG_LABELS[tag]),
      line: styleDone ? null : "Setting, art direction and rules.",
    }),
    card("sportswear", "Sportswear", { pill: "KW", line: sportswearLine(record) }),
  ];
}

/** Whether nothing at all has been saved: the Brand page then shows its empty state (d16). */
export const brandIsEmpty = (record: BrandRecord): boolean =>
  record.profile.about.trim() === "" &&
  record.palettes.length === 0 &&
  record.assets.length === 0 &&
  record.fonts.every((font) => font.fontKey === null) &&
  STYLE_FIELDS.every((field) => record.profile.style[field].trim() === "");

/** "LL" for "Lahore Lions FC": the initials the side card shows when there is no logo. */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word) && word !== word.toUpperCase())
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || name.trim().charAt(0).toUpperCase();
