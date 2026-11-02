/**
 * The fixed words of brand import (spec F-S9 "Import your brand", plan v5 L7, decision 0102).
 *
 * No zod here, so the screen can import the labels without shipping the schema library
 * (tests/architecture/client-weight.test.ts).
 *
 * Two things in this file are the whole feature's safety. The first is that an import **reads** a
 * site and keeps nothing of it: the refusals below are the only thing a site ever leaves behind
 * when it cannot be read. The second is that nothing here states a licence, a measurement or a
 * colour match; where a sentence could be read as one, it says whose estimate it is.
 */

import { RULES as BRAND_RULES } from "../words";

/** Who we say we are, on every request. A site owner can look us up and block us. */
export const IMPORT_USER_AGENT = "KnitwrightBrandImport/1.0 (+https://knitwright.com/bot)";

/** The name this fetch answers to in robots.txt, lower case. Z3's own name is a different group. */
export const IMPORT_ROBOTS_NAME = "knitwrightbrandimport";

/** The label every seeded default of this workstream carries, as the plan asks. */
export const DRAFT_LABEL = "Knitwright draft v0.1, not reviewed by anyone";

/**
 * The stages of one import, in the order they run. The screen shows all six from the start, so a
 * person can see what is coming and what is left, and no stage ever sits without a word beside it.
 */
export const IMPORT_STAGES = ["page", "logos", "colours", "fonts", "graphics", "style"] as const;
export type ImportStage = (typeof IMPORT_STAGES)[number];

export const STAGE_LABELS: Readonly<Record<ImportStage, string>> = {
  page: "Reading your site",
  logos: "Looking for your logos",
  colours: "Reading your colours",
  fonts: "Matching your fonts",
  graphics: "Looking for product photos",
  style: "Writing your visual style",
};

/** What each stage is doing while it runs. Shown beside the spinner, so a minute never looks frozen. */
export const STAGE_RUNNING: Readonly<Record<ImportStage, string>> = {
  page: "Asking your site for one page, and reading its words.",
  logos: "Reading the favicon and any mark the page points at.",
  colours: "Working out the colours the page uses.",
  fonts: "Comparing the page's fonts with the fonts Knitwright may use.",
  graphics: "Reading the sizes of the product photos the page points at.",
  style: "Reading five or more of your own pictures and writing three paragraphs.",
};

/** What a stage that produced nothing means, said plainly rather than left blank. */
export const STAGE_EMPTY: Readonly<Record<ImportStage, string>> = {
  page: "Nothing could be read from that address.",
  logos: "No logo was found on that page. Add one from your uploads instead.",
  colours: "No colour was found on that page. Add a palette by hand instead.",
  fonts: "No font was named on that page. Pick a font for each role instead.",
  graphics: "No product photo was found on that page. Upload your own photos instead.",
  style: "Five or more of your own pictures are needed before a visual style can be written. Write the three texts by hand instead.",
};

/**
 * Why a site could not be read, and what to do about it. Every reason answers both questions,
 * because "we could not read your site" on its own tells a person nothing.
 */
export const REFUSAL_REASONS = [
  "bad_url",
  "not_https",
  "private_host",
  "robots",
  "not_a_page",
  "too_large",
  "too_slow",
  "unreachable",
  "not_your_site",
  "rate_limited",
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export const REFUSALS: Readonly<Record<RefusalReason, string>> = {
  bad_url: "That is not a web address. Paste your site's address, starting with https://.",
  not_https: "That address is not secure. Paste the https:// address of your site, or type your brand in by hand.",
  private_host: "That address is not a public web page, so there is nothing to read. Paste your site's public address.",
  robots:
    "Your site's robots.txt asks us not to read that page, so we have not. Allow KnitwrightBrandImport in robots.txt, or type your brand in by hand.",
  not_a_page: "That address is a file, not a web page. Paste the address of your home page.",
  too_large: "That page is too big to read in the time we allow. Paste a smaller page, such as your home page.",
  too_slow: "Your site did not answer in time. Try again in a minute, or type your brand in by hand.",
  unreachable: "Your site could not be reached. Check the address, try again in a minute, or type your brand in by hand.",
  not_your_site: "That address is on a different site from the one the page named. Import only your own site or Instagram page.",
  rate_limited: "This brand has run as many imports as it may for now. Try again later, or type your brand in by hand.",
};

/** Which refusals are worth offering "Try again" for: the ones that may answer differently in a minute. */
export const WORTH_RETRYING: readonly RefusalReason[] = ["too_slow", "unreachable", "rate_limited"];

/** What an import proposes, one kind per tab of the brand page. */
export const ITEM_KINDS = ["logo", "colour", "font", "graphic", "style"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Readonly<Record<ItemKind, string>> = {
  logo: "Logo",
  colour: "Colour",
  font: "Font",
  graphic: "Graphic",
  style: "Visual style",
};

/** One item's state. Nothing is taken in until a person says so, so everything starts `pending`. */
export const DECISIONS = ["pending", "accepted", "rejected"] as const;
export type Decision = (typeof DECISIONS)[number];

/** The two buttons on each row. Per item, never all or nothing. */
export const DECISION_LABELS: Readonly<Record<Exclude<Decision, "pending">, string>> = {
  accepted: "Keep",
  rejected: "Leave out",
};

/**
 * The rules behind what an import says.
 *
 * `R-SUB-003`, `R-SUB-005`, `R-SUB-007` and `R-SUB-008` are real entries of
 * `docs/spec/articles/JSY-SS-01/rulebook.md`. The four `R-GAP-000`s below are listed on the pull
 * request, as the plan requires: the rulebook has no entry for a printable gamut, for which fonts
 * the platform may use, for whether a web address belongs to the brand that pasted it, or for how a
 * visual style may be written from a brand's own pictures.
 */
export const RULES = {
  /** "150 DPI at 1:1, sRGB, not mirrored", and vector logos where possible. */
  printResolution: BRAND_RULES.printResolution,
  /** "Colours are checked against a printed strike-off." Why a screen colour is not a factory reference. */
  colourStrikeOff: BRAND_RULES.colourStrikeOff,
  /** "Minimum line 0.5 mm, minimum text 6 pt." Why a hairline face makes a poor name-and-number font. */
  fineDetail: "R-SUB-007",
  /** "Rich black is the factory's own black recipe, not 0/0/0 RGB." */
  richBlack: "R-SUB-008",
  /** No rulebook entry for the printable gamut (Y6's own gap, reused rather than renamed). */
  gamutEstimate: BRAND_RULES.gamutEstimate,
  /** No rulebook entry for which fonts the platform may use. */
  fontLicence: "R-GAP-000",
  /** No rulebook entry for whether an address belongs to the brand that pasted it. */
  ownSite: "R-GAP-000",
  /** No rulebook entry for writing a visual style from a brand's own pictures. */
  writtenStyle: "R-GAP-000",
} as const;

/** The gaps this workstream opens, for the pull request comment. */
export const IMPORT_RULE_GAPS = [
  "R-GAP-000 printable gamut: which colours a sublimation press can reach (opened by Y6, reused here)",
  "R-GAP-000 font licence: which fonts the platform may use for a brand, and on a garment",
  "R-GAP-000 own site: how we know a pasted address belongs to the brand that pasted it",
  "R-GAP-000 written style: how a visual style may be written from a brand's own pictures",
] as const;

/**
 * The rights tick beside the pictures an import found. It is never ticked for the person: the words
 * are `LOGO_RIGHTS` of `lib/consent/wording.ts`, the same words as every other artwork upload, and
 * the tick is recorded with the file by `lib/storage/rights.ts`.
 */
export const RIGHTS_ASK = "Tick the box to say you own these pictures, or may use them on garments. Nothing is kept until you do.";

/** Said wherever an imported picture is offered. The picture is read, and dropped, until the tick. */
export const NOTHING_KEPT_YET =
  "Knitwright keeps nothing from your site: the page is read, the colours and the sizes are worked out, and the page itself is dropped.";

/** What a brand is told about the fonts it cannot have. Never implies a licence Knitwright does not hold. */
export const FONT_LICENCE_ASK =
  "Knitwright may only set type in a font whose licence is in this repository, so your own font cannot be offered yet.";

/** What the import is for, on the empty state, with the one action that fills it. */
export const EMPTY_IMPORT = {
  heading: "Import your brand from your own site",
  body: "Paste the https:// address of your own website or Instagram page. Knitwright reads one page of it, about a minute's work, and shows you what it found. You choose what to keep.",
  action: "Paste your address",
} as const;
