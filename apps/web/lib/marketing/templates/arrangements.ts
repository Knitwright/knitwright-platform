import { slot, type MarketingSlot, type SlotRect } from "./types";

/**
 * THE ARRANGEMENTS a marketing layout is built from (plan v5 L4, decision 0094).
 *
 * `07` names thirty marketing layouts across six groups. They are not thirty different ideas: they
 * are a handful of arrangements of the same parts -- a mockup, a crest or logo, a headline, a
 * subheadline, a line of body text, sometimes a QR chip. Each arrangement is written once here, in
 * fractions of the artboard, and `plans.ts` says which layout uses which. Writing the thirty out
 * slot by slot would be the same shapes copied thirty times, and the first edit would miss some.
 *
 * Nothing overlaps anything: `arrangements.test.ts` holds every arrangement to that, because a
 * layout whose headline sits on the garment is a layout that redrew the picture (spec decision 13),
 * and `layout.ts` refuses it rather than moving the mockup.
 *
 * Every number is Knitwright's own and nobody has reviewed it (`MARKETING_GAPS`). The margin is one
 * number, so a change to the breathing room is one edit.
 */

/** The breathing room round everything, as a fraction of the artboard. */
export const MARGIN = 0.06;

/** The most characters each kind of text field takes. Knitwright's own figures; see MARKETING_GAPS. */
export const LIMITS = { headline: 40, subheadline: 70, body: 160, callout: 48 } as const;

const inner = 1 - MARGIN * 2;

/** The right-hand column of a two-column arrangement, and the left one beside it. */
const RIGHT = { x: 0.54, width: 0.4 };
const LEFT = { x: MARGIN, width: 0.4 };

type Column = Readonly<{ x: number; width: number }>;
const FULL: Column = { x: MARGIN, width: inner };

const rect = (column: Column, y: number, height: number): SlotRect => ({ x: column.x, y, width: column.width, height });

const mockup = (id: string, y: number, height: number, column: Column = FULL): MarketingSlot =>
  slot({
    id,
    kind: "mockup",
    label: id === "mockup" ? "Mockup" : `Mockup ${id.slice(-1)}`,
    rect: rect(column, y, height),
  });

const logo = (): MarketingSlot =>
  slot({ id: "logo", kind: "logo", label: "Logo or crest", rect: { x: MARGIN, y: MARGIN, width: 0.16, height: 0.07 }, colourRole: "trim" });

const headline = (y: number, height = 0.1, column: Column = FULL): MarketingSlot =>
  slot({ id: "headline", kind: "text", label: "Headline", rect: rect(column, y, height), style: "headline", limit: LIMITS.headline, placeholder: "Headline", colourRole: "primary" });

const subheadline = (y: number, column: Column = FULL): MarketingSlot =>
  slot({ id: "subheadline", kind: "text", label: "Subheadline", rect: rect(column, y, 0.07), style: "subheadline", limit: LIMITS.subheadline, placeholder: "One line more", colourRole: "secondary" });

const body = (id: string, y: number, height = 0.1, column: Column = FULL): MarketingSlot =>
  slot({
    id,
    kind: "text",
    label: id === "body" ? "Body text" : `Callout ${id.slice(-1)}`,
    rect: rect(column, y, height),
    style: "body",
    limit: id === "body" ? LIMITS.body : LIMITS.callout,
    placeholder: id === "body" ? "What this is about" : "One feature",
    colourRole: "secondary",
  });

const qr = (y: number): MarketingSlot =>
  slot({ id: "qr", kind: "qr", label: "QR chip", rect: { x: 1 - MARGIN - 0.16, y, width: 0.16, height: 0.16 }, colourRole: "accent" });

const backdrop = (): MarketingSlot =>
  slot({ id: "backdrop", kind: "shape", label: "Background", rect: { x: 0, y: 0, width: 1, height: 1 }, colourRole: "background" });

/** One big mockup with the words under it: the reveal post, the drop announcement, the restock. */
export const hero = (): readonly MarketingSlot[] => [backdrop(), logo(), mockup("mockup", 0.16, 0.48), headline(0.68), subheadline(0.8)];

/** Two mockups side by side, for the home and away shirts of one kit. */
export const split = (): readonly MarketingSlot[] => [
  backdrop(),
  logo(),
  mockup("mockup-1", 0.16, 0.48, { x: MARGIN, width: 0.42 }),
  mockup("mockup-2", 0.16, 0.48, { x: 0.52, width: 0.42 }),
  headline(0.68),
  subheadline(0.8),
];

/** A number or a short word above the mockup, for a countdown, a matchday or a last-chance story. */
export const standout = (): readonly MarketingSlot[] => [backdrop(), logo(), headline(0.16, 0.18), mockup("mockup", 0.38, 0.4), subheadline(0.82)];

/** Words beside the mockup, which is how a wide banner reads. */
export const beside = (): readonly MarketingSlot[] => [
  backdrop(),
  logo(),
  mockup("mockup", 0.16, 0.7, { x: 0.52, width: 0.42 }),
  headline(0.2, 0.12, LEFT),
  subheadline(0.36, LEFT),
  body("body", 0.48, 0.3, LEFT),
];

/** A mockup with three callouts beside it: fabric, fit, features (`07`'s product feature). */
export const callouts = (): readonly MarketingSlot[] => [
  backdrop(),
  logo(),
  mockup("mockup", 0.16, 0.66, { x: MARGIN, width: 0.42 }),
  headline(0.16, 0.1, RIGHT),
  body("callout-1", 0.32, 0.12, RIGHT),
  body("callout-2", 0.48, 0.12, RIGHT),
  body("callout-3", 0.64, 0.12, RIGHT),
];

/** Headline, a block of lines and nothing else: a fixtures list, a size guide, a size reminder. */
export const written = (): readonly MarketingSlot[] => [backdrop(), logo(), headline(0.18), body("body", 0.32, 0.5)];

/** The mockup on its own, for a listing image: no words, nothing over the garment. */
export const plain = (): readonly MarketingSlot[] => [backdrop(), mockup("mockup", MARGIN, inner)];

/** The mockup, the words and a QR chip people can point a phone at. */
export const scanable = (): readonly MarketingSlot[] => [
  backdrop(),
  logo(),
  mockup("mockup", 0.16, 0.42),
  headline(0.6, 0.1),
  subheadline(0.72, { x: MARGIN, width: 0.66 }),
  qr(0.72),
];

/** A poster: the headline over the mockup, the words and a chip at the foot. */
export const poster = (): readonly MarketingSlot[] => [
  backdrop(),
  logo(),
  headline(0.15, 0.12),
  mockup("mockup", 0.3, 0.42),
  body("body", 0.74, 0.14, { x: MARGIN, width: 0.5 }),
  qr(0.74),
];

/** A name and a number under a portrait mockup: a new signing, a player of the match. */
export const portrait = (): readonly MarketingSlot[] => [backdrop(), logo(), mockup("mockup", 0.16, 0.56), headline(0.74, 0.11), subheadline(0.86)];

export const ARRANGEMENTS = { hero, split, standout, beside, callouts, written, plain, scanable, poster, portrait } as const;

export type ArrangementName = keyof typeof ARRANGEMENTS;
