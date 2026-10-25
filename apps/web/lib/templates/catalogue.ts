import { KIT_PATTERN_LABELS, KIT_PATTERN_STYLES } from "@/lib/garment";

/** The sports a template may be filed under. Knitwright's own tags; they say what a kit is for, not that a league accepts it. */
export const SPORTS = ["football", "cricket", "running", "training", "general"] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Readonly<Record<Sport, string>> = {
  football: "Football",
  cricket: "Cricket",
  running: "Running",
  training: "Training",
  general: "Club and team wear",
};

/** The style tags a template may carry: the kit patterns, and plain. */
export const STYLE_IDS = ["plain", ...KIT_PATTERN_STYLES] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const STYLE_LABELS: Readonly<Record<StyleId, string>> = { plain: "Plain", ...KIT_PATTERN_LABELS };

/** Who made a template. Only Knitwright can today; `designer` is reserved and the database refuses it. */
export const OPEN_TEMPLATE_SOURCES = ["knitwright"] as const;

export const REVIEW_STATES = ["not_reviewed", "reviewed"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** What the screen says about a template's review. Never "approved" or "verified": see lib/techpack/wording.test.ts. */
export const REVIEW_LABELS: Readonly<Record<ReviewState, string>> = {
  not_reviewed: "Knitwright starter, not reviewed by a factory",
  reviewed: "Reviewed by a factory",
};
