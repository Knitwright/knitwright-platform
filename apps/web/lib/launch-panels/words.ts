/**
 * THE WORDS OF THE FOUR RAIL PANELS NO WORKSTREAM OWNED (plan v5, decision 0108).
 *
 * L1's panel contract names a workstream for every panel of the icon rail, and four of them named
 * a workstream the plan gave no component path: Templates and Likes to L8, Uploads and Brand to
 * L7. Both workstreams stopped at their boundary and said so -- L8's record notes that
 * `components/templates/**` belong to no wave-4 workstream, and L7 wrote the renderer's contract
 * into decision 0102 item 10 rather than reaching outside `lib/brand-studio/import/**`. This
 * directory is the panels they left.
 *
 * No zod here, so a client panel can import these labels without shipping the schema library
 * (`tests/architecture/client-weight.test.ts`).
 *
 * Every sentence obeys the house rule that nothing may read as settled when it is not: a template
 * whose article has no measurement on file says so, a font with no licence on file says so, and the
 * rights recorded with an upload are shown as a record of what a person said, never as a right the
 * platform has established.
 */

import type { Route } from "next";

/** The three panels of this directory that show real rows. Likes is the one that honestly cannot. */
export const BUILT_HERE = ["templates", "uploads", "brand"] as const;
export type BuiltHere = (typeof BUILT_HERE)[number];

export const PANEL_TITLES: Readonly<Record<BuiltHere, string>> = {
  templates: "Templates",
  uploads: "Uploads",
  brand: "Brand",
};

export const PANEL_LEADS: Readonly<Record<BuiltHere, string>> = {
  templates:
    "Ready-made sportswear designs to remix, and the packs that turn one design into a whole launch. Search the designs, or narrow them by sport, style, era, mood and colour.",
  uploads: "The files you have uploaded to this brand, newest first, with the rights recorded on each one.",
  brand: "Your palettes, your type styles and the words that steer every picture made for you.",
};

/** Shown while a panel is reading its rows. A panel never looks frozen and never looks empty. */
export const LOADING: Readonly<Record<BuiltHere, string>> = {
  templates: "Reading the template library.",
  uploads: "Reading your uploads.",
  brand: "Reading your brand.",
};

/** When a read fails. Each one says what to do, because "something went wrong" says nothing. */
export const FAILED: Readonly<Record<BuiltHere, string>> = {
  templates: "The template library could not be read. Try again in a moment; nothing on your canvas has changed.",
  uploads: "Your uploads could not be read. Try again in a moment; nothing on your canvas has changed.",
  brand: "Your brand could not be read. Try again in a moment; nothing on your canvas has changed.",
};

export const RETRY = "Try again";

/** The real empty states: what is not there, and the one action that fills it. */
export const EMPTY_TITLES: Readonly<Record<BuiltHere, string>> = {
  templates: "No template in the library yet",
  uploads: "Nothing uploaded yet",
  brand: "Your brand is empty",
};

export const EMPTY_BODIES: Readonly<Record<BuiltHere, string>> = {
  templates: "The library is seeded by the platform, so an empty list is a fault rather than a choice. Open the library page to see what is there.",
  uploads: "Upload a logo, a crest or a photograph and it appears here, with the rights you recorded on it.",
  brand: "Set up your brand once -- its palettes, its type styles and its voice -- and every picture made for you can use it.",
};

/** One action per empty state, and the address it opens. Every one of them exists today. */
export const EMPTY_ACTIONS: Readonly<Record<BuiltHere, Readonly<{ label: string; href: Route }>>> = {
  templates: { label: "Open the template library", href: "/templates" },
  uploads: { label: "Upload a picture", href: "/brand-studio?tab=logos" },
  brand: { label: "Set up your brand", href: "/brand-studio" },
};

/* ---------------------------------------------------------------------------------------------
 * The templates panel.
 */

export const SEARCH_LABEL = "Search the templates";
export const SEARCH_PLACEHOLDER = "Football, retro, navy…";
export const CLEAR_FILTERS = "Clear the filters";
export const NO_MATCH_TITLE = "No template matches";
export const NO_MATCH_BODY = "Clear a filter or shorten what you typed. Every filter narrows the list; none of them adds to it.";
export const USE_TEMPLATE = "Start a design from this";
export const SHOW_ALL = "Show all";
export const SHOW_FEWER = "Show fewer";

/** How many of a collection are shown before Show all, as the mockup library shows its own. */
export const SHOWN_PER_COLLECTION = 4;

/**
 * Said under the list. A design template becomes a new design of its own, which opens in the
 * editor: it is not laid onto this canvas, because a launch canvas launches a design that already
 * exists.
 */
export const OPENS_THE_EDITOR =
  "Starting a design from a template makes a new design in your brand and opens the editor on it. Your launch canvas is left exactly as it is.";

/**
 * Why the panel offers design templates and the flow packs, but not the library's other kinds. The
 * packs are listed in this panel itself (`components/launch/panels/FlowPacks.tsx`), so this no
 * longer sends anyone to the canvas to look for something no screen offered.
 */
export const OTHER_KINDS =
  "Marketing templates open on a Marketing board and mockup scenes are in the Mockups panel, so neither is listed twice here.";

export const OPEN_MOCKUPS = "Open the Mockups panel";

/* ---------------------------------------------------------------------------------------------
 * The uploads panel.
 */

/** What the record beside a file says. A record of what a person said, never a right we established. */
export const RIGHTS_RECORDED = "You said you own this or may use it on garments";
export const RIGHTS_WORDING_NOTE = "These were the words on screen when the file was uploaded.";

/**
 * The one honest gap of the uploads panel. `user_artworks` records who said it, when they said it
 * and the version of the words they saw -- and nothing else. No rulebook entry says what evidence a
 * brand must hold for a picture it prints, so nothing here says the question is settled.
 */
export const RIGHTS_GAP = {
  ruleId: "R-GAP-000",
  line: "A file carries what you said about it and when you said it. No rule anywhere says what evidence a brand must keep for a picture it prints, so this is a record and not a clearance.",
} as const;

export const UPLOAD_NOT_PLACED =
  "Placing an upload on an artboard is the Elements panel's own work. This panel is your file list and the rights recorded on each file.";

/* ---------------------------------------------------------------------------------------------
 * The brand panel.
 */

export const PALETTE_HEADING = "Palettes";
export const FONT_HEADING = "Type styles";
export const VOICE_HEADING = "Voice";
export const STYLE_HEADING = "Visual style";
export const APPLY_PALETTE = "Use this palette on the project";
export const NO_PALETTE = "No palette on your brand yet. Add one in Brand Studio and it is here in one click.";
export const NO_FONT = "No type style chosen yet. Pick one for each role in Brand Studio.";
export const NO_VOICE = "No voice words yet. Brand Studio takes them from a short list, so nothing is guessed for you.";
export const NO_STYLE = "The three visual-style texts are empty. Write them in Brand Studio, or import them from your own site.";
export const OPEN_IMPORT = "Import your brand from your site";

export const paletteApplied = (name: string): string => `The project colours are now your ${name} palette.`;

/**
 * The one thing the brand panel will not do. A type style is shown with its licence note, but
 * setting type in a font is the Text panel's work, and only a font whose licence is in this
 * repository may be set at all (decision 0079).
 */
export const FONT_NOT_APPLIED = "Setting type in one of these is the Text panel's own work. Only a font whose licence is in this repository can be set at all.";

/** Said beside a font the brand holds no licence for, so the row is never offered as usable. */
export const FONT_LICENCE_GAP = {
  ruleId: "R-GAP-000",
  line: "No rulebook entry says which fonts the platform may use for a brand, or on a garment. The licence note beside each row is what this repository can show.",
} as const;

/* ---------------------------------------------------------------------------------------------
 * The likes panel, which is honestly not built.
 */

/**
 * **Nothing in this platform records a like.** The spec's own data model (`03-data-model.md`) puts
 * `likes` on a `template` row as a count, not as a record of who liked what, and no migration in
 * this repository has either: there is no `likes` column, no join table and no favourite anywhere.
 * The nearest thing that exists is a design's moodboard (F-S1, decision 0082), which holds
 * references to other people's pictures against one design and is not a like on a template.
 *
 * So the panel keeps its labelled placeholder and this is an owner question. An empty grid with a
 * heart on it would be a feature that looks real and is not one.
 */
export const LIKES_GAP = {
  ruleId: "R-GAP-000",
  line: "Nothing in the platform records a like. The spec's data model has a likes count on a template row, not a record of who liked what, and no table holds either.",
} as const;
