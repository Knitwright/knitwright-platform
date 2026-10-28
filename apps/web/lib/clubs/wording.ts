/**
 * Constants and words the club screens show. No zod here, so a browser component can import them
 * without shipping the schema library (tests/architecture/client-weight.test.ts).
 */
export const KIT_FONTS = ["geist"] as const;
export const SPONSORS_MAX = 3;

export const WEARER_GROUPS = ["mens", "womens", "junior", "unisex"] as const;
export type WearerGroup = (typeof WEARER_GROUPS)[number];

export const WEARER_LABELS: Readonly<Record<WearerGroup, string>> = {
  mens: "Men's",
  womens: "Women's",
  junior: "Junior",
  unisex: "Unisex",
};

export const ROSTER_PLAYERS_MAX = 1000;

export const APPLY_PARTS = ["colours", "crest", "sponsors"] as const;
export type ApplyPart = (typeof APPLY_PARTS)[number];

export const PART_LABELS: Readonly<Record<ApplyPart, string>> = {
  colours: "Club colours",
  crest: "Crest",
  sponsors: "Sponsors",
};
