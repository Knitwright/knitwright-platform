import type { CollectionPlan, Style } from "./types";
import { LOOSE_GROUP } from "./vocabulary";

/**
 * The collection board's counters (spec F-S10): every frame shows Styles · Style-colourways · SKUs,
 * and the right panel shows the same for the whole range, then per group, per colourway and per colour.
 *
 * A style card is one style in one colourway, so:
 *   * Styles is how many style names the cards hold;
 *   * Style-colourways is how many cards there are, counted by name and colourway;
 *   * SKUs is how many name, colourway and size rows carry at least one piece — a size planned at zero
 *     is not a thing anyone can buy, so it is not a SKU.
 */

export interface Counters {
  readonly styles: number;
  readonly colourways: number;
  readonly skus: number;
  readonly units: number;
}

/** The pieces planned for a style: the sum of its size rows, never a figure of its own. */
export const unitsOf = (style: Style): number => style.sizes.reduce((total, size) => total + size.qty, 0);

const key = (style: Style): string => `${style.name}\u0000${style.colourway}`;

export function counters(styles: readonly Style[]): Counters {
  return {
    styles: new Set(styles.map((style) => style.name)).size,
    colourways: new Set(styles.map(key)).size,
    skus: new Set(styles.flatMap((style) => style.sizes.filter((size) => size.qty > 0).map((size) => `${key(style)}\u0000${size.label}`))).size,
    units: styles.reduce((total, style) => total + unitsOf(style), 0),
  };
}

/** "3 styles · 5 style-colourways · 30 SKUs", the line under a frame's name. */
export const countersText = (count: Counters): string =>
  `${count.styles} ${count.styles === 1 ? "style" : "styles"} · ${count.colourways} style-${count.colourways === 1 ? "colourway" : "colourways"} · ${count.skus} ${count.skus === 1 ? "SKU" : "SKUs"}`;

export interface GroupCounters extends Counters {
  readonly frameId: string | null;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly styleCards: readonly Style[];
}

/** Every frame of the plan with the styles in it, and last the styles that sit in no frame. */
export function groups(plan: CollectionPlan): readonly GroupCounters[] {
  const framed = plan.frames.map((frame) => {
    const styleCards = plan.styles.filter((style) => style.frameId === frame.id);
    return { frameId: frame.id, name: frame.name, x: frame.x, y: frame.y, styleCards, ...counters(styleCards) };
  });
  const loose = plan.styles.filter((style) => style.frameId === null);
  return loose.length === 0 ? framed : [...framed, { frameId: null, name: LOOSE_GROUP, x: 0, y: 0, styleCards: loose, ...counters(loose) }];
}

export interface Tally {
  readonly label: string;
  readonly styles: number;
  readonly skus: number;
  readonly units: number;
}

/** One tally per colourway named on the cards, most SKUs first, then by name. */
export function colourwayTally(styles: readonly Style[]): readonly Tally[] {
  const names = [...new Set(styles.map((style) => (style.colourway === "" ? "No colourway yet" : style.colourway)))];
  return names
    .map((label) => {
      const cards = styles.filter((style) => (style.colourway === "" ? "No colourway yet" : style.colourway) === label);
      const count = counters(cards);
      return { label, styles: count.styles, skus: count.skus, units: count.units };
    })
    .sort((a, b) => b.skus - a.skus || a.label.localeCompare(b.label));
}

/**
 * The right-hand totals panel: the range, then the groups, then the colourways. The spec also asks for
 * Colours; the plan holds colourway names, not a colour list, so the panel shows those names and says
 * where a real colour breakdown would come from (`COLOURS_NOT_READ`, rule R-GAP-000).
 */
export interface TotalsPanel {
  readonly range: Counters;
  readonly groups: readonly GroupCounters[];
  readonly colourways: readonly Tally[];
}

export const totalsPanel = (plan: CollectionPlan): TotalsPanel => ({
  range: counters(plan.styles),
  groups: groups(plan),
  colourways: colourwayTally(plan.styles),
});

/** The sizes any card in the plan plans, in the order they first appear. */
export const sizesOf = (styles: readonly Style[]): readonly string[] => [
  ...new Set(styles.flatMap((style) => style.sizes.filter((size) => size.qty > 0).map((size) => size.label))),
];
