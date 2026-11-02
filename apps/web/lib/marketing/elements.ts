import { MARKETING_RULE } from "./rules";
import type { ColourRole } from "./templates/types";

/**
 * THE ELEMENTS PANEL (spec Launch shell: "Elements (sport graphics)"; plan v5 L4, decision 0094).
 *
 * Every element here is **drawn by this code**, as a path on a unit square. Nothing is a file, and
 * nothing is a third-party graphic: the plan forbids committing a scraped or licensed asset, and a
 * sport-graphics library nobody has licensed would be exactly that. So what the panel offers is the
 * shapes a kit layout is actually made of -- a band, a sash, a chevron, a badge, a stripe set -- and
 * the owner question on the pull request asks whether a licensed graphics library should be bought.
 *
 * Each element takes a colour role, never a colour, so a brand palette changes all of them at once.
 */

export const ELEMENT_KINDS = ["shape", "badge", "divider"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export interface MarketingElement {
  readonly id: string;
  readonly label: string;
  readonly kind: ElementKind;
  /** The shape on a unit square, as an SVG path. Scaled to whatever rectangle it is placed in. */
  readonly path: string;
  readonly colourRole: ColourRole;
  readonly ruleId: string;
}

const element = (id: string, label: string, kind: ElementKind, path: string, colourRole: ColourRole = "accent"): MarketingElement => ({
  id,
  label,
  kind,
  path,
  colourRole,
  ruleId: MARKETING_RULE,
});

/**
 * The elements the panel offers. Each path is on the square from 0,0 to 1,1, so one shape works at
 * any size and in any slot.
 */
export const ELEMENTS: readonly MarketingElement[] = [
  element("band", "Chest band", "shape", "M0,0.4 L1,0.4 L1,0.6 L0,0.6 Z", "primary"),
  element("sash", "Sash", "shape", "M0,1 L0.35,1 L1,0 L0.65,0 Z", "secondary"),
  element("chevron", "Chevron", "shape", "M0,0 L0.5,0.4 L1,0 L1,0.25 L0.5,0.65 L0,0.25 Z"),
  element("stripes", "Stripe set", "shape", "M0,0 L0.2,0 L0.2,1 L0,1 Z M0.4,0 L0.6,0 L0.6,1 L0.4,1 Z M0.8,0 L1,0 L1,1 L0.8,1 Z", "secondary"),
  element("shield", "Shield badge", "badge", "M0.5,0 L1,0.18 L1,0.6 Q1,0.9 0.5,1 Q0,0.9 0,0.6 L0,0.18 Z", "trim"),
  element("roundel", "Roundel", "badge", "M0.5,0 A0.5,0.5 0 1,1 0.499,0 Z", "trim"),
  element("rosette", "Star", "badge", "M0.5,0 L0.62,0.36 L1,0.36 L0.69,0.59 L0.81,0.95 L0.5,0.72 L0.19,0.95 L0.31,0.59 L0,0.36 L0.38,0.36 Z"),
  element("rule", "Rule", "divider", "M0,0.45 L1,0.45 L1,0.55 L0,0.55 Z", "trim"),
  element("corner", "Corner flash", "divider", "M0,0 L1,0 L1,0.3 L0,1 Z", "accent"),
];

export const elementById = (id: string): MarketingElement | null => ELEMENTS.find((one) => one.id === id) ?? null;

export const elementsOfKind = (kind: ElementKind): readonly MarketingElement[] => ELEMENTS.filter((one) => one.kind === kind);

export const ELEMENT_KIND_LABELS: Readonly<Record<ElementKind, string>> = {
  shape: "Shapes",
  badge: "Badges",
  divider: "Dividers",
};

/** Said in the panel, so nobody waits for artwork that is not coming. */
export const NO_LIBRARY_NOTE =
  "These are drawn by the platform, so they take your brand colours. No licensed graphics library is on file yet.";

/**
 * How a unit-square element is put on a rectangle of the artboard: a transform, not a rewritten
 * path. Rewriting the numbers would have to understand every kind of curve, and a transform
 * understands all of them for nothing.
 */
export const elementTransform = (rect: Readonly<{ x: number; y: number; width: number; height: number }>): string =>
  `translate(${rect.x} ${rect.y}) scale(${rect.width} ${rect.height})`;
