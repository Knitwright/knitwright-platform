/**
 * The words of the crest-to-kit screen, in one place and in plain English (spec F-T2).
 *
 * This file imports nothing but its own settings, so a client component can take a heading or a
 * refusal from it without pulling the garment rules — and so zod — into the browser
 * (`tests/architecture/client-weight.test.ts`).
 *
 * Every empty state names the ONE action that fills it, every error says what to do, and nothing
 * here promises a date, a price or a colour match.
 */

import { CREST_LIMITS, ROLE_LABELS, type RoleChoice } from "./settings";

export const PAGE_TITLE = "Crest to kit";
export const PAGE_EYEBROW = "Teamwear";
export const PAGE_LEAD =
  "Upload your club crest, or pick your colours, and Knitwright builds complete kits around them: shirt, shorts and socks, each one a kit the factory can actually make. Open any kit to change it.";

/** The empty state. One action fills the screen, and this names it. */
export const EMPTY_TITLE = "No kits yet";
export const EMPTY_BODY = "Upload your crest and press Show me kits. Knitwright reads your colours from it and builds kits around them.";
export const EMPTY_ACTION = "Show me kits";

/** While the kits are being built. It says what is happening, in order, and never sits still. */
export const STEPS: readonly string[] = [
  "Reading your crest",
  "Finding your colours",
  "Checking they can be printed",
  "Building the kits",
  "Checking each one can be made",
];

export const BUSY_LABEL = "Building your kits";

/** What a club reads when something went wrong on the way. It always says what to do next. */
export const REFUSALS = {
  generic: "Something went wrong while Knitwright was building your kits. Try again, and tell Knitwright if it keeps happening.",
  noFile: "Choose your crest file first, or pick your colours instead.",
  unreadable: "That file could not be read as a picture. Export your crest again as a PNG, an SVG or a PDF, and try again.",
} as const;

/** The labels of the controls. Each one is the label a screen reader reads. */
export const LABELS = {
  crest: "Your club crest",
  clubName: "Club name (optional)",
  sport: "Sport",
  roles: "Which kits",
  feel: "How it should feel",
  colours: "Or pick your colours",
  submit: EMPTY_ACTION,
  again: "Build them again",
} as const;

/** Said under the file input, after the formats line the crest module already owns. */
export const NOTHING_STORED = "Nothing is stored: your crest is read and then forgotten.";

export const HINTS = {
  clubName: "It goes on the quote. Leave it empty and your workspace name is used.",
  colours: `Pick up to ${CREST_LIMITS.maxPickedColours} if you have no crest file to hand.`,
} as const;

/** The heading over the colours read from a crest. */
export const PALETTE_TITLE = "Your colours";
export const PALETTE_EMPTY = "No colour could be read yet.";

/** The heading over the kits, and the count beside it. */
export const KITS_TITLE = "Your kits";
export const kitsCount = (count: number, roles: RoleChoice): string =>
  `${count} ${count === 1 ? "kit" : "kits"} for ${ROLE_LABELS[roles].toLowerCase()}, each one checked against the base article before it was shown.`;

/** On every card. It is the plain truth about what the card is. */
export const CARD_OPEN = "Open in the configurator";
export const CARD_QUOTE = "Quote this kit";

/** Said once under the kits: the thing a club most needs to know about a price. */
export const PRICE_NOTE =
  "Prices come from the factory's own price tiers and are shown in the configurator. A busy design costs the same as a plain one: the whole panel is printed either way.";

/** Said once under the kits: there is no delivery date to show anywhere yet. */
export const NO_DATE_NOTE =
  "No delivery date can be shown yet: the days for QC and the freight days are not set in the factory data on file, so neither this screen nor a quote can work one out.";

/** Said once beside the colours: Knitwright holds no Pantone values and does not pretend to. */
export const COLOUR_NOTE =
  "Each colour is shown as your crest has it and as a sublimation print is estimated to reach it. The estimate is Knitwright's own, not a colour match, and the true range needs your print house's ICC profile.";
