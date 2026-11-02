import { landedCost, noRates, type LandedCost } from "./landed";
import { unitsOf } from "./board";
import type { CollectionPlan, PricingByStyle, Style } from "./types";
import type { StyleStatus } from "./vocabulary";

/**
 * The line plan table (spec F-S10): one row per style, expandable into size rows, priced from the
 * factory tiers at the whole plan's quantity, with the wholesale and D2C split, the RRP and the margin.
 *
 * The footer's `tierCostMinor` is the sum of the tier lines and nothing else, so it equals the price of
 * the same basket to the penny (the acceptance test, in line-plan.test.ts). `landedCostMinor` is that
 * plus the freight and duty each row carries.
 *
 * A figure nobody has set is null, never zero. A margin is only shown where both the revenue and the
 * landed cost are known, because a margin against an unknown cost is a made-up number.
 */

export interface LineSizeRow {
  readonly label: string;
  readonly qty: number;
  /** The landed cost of this size's pieces, at the plan's tier. Null where the style has no price. */
  readonly landedMinor: number | null;
}

export interface LineRow {
  readonly styleId: string;
  readonly name: string;
  readonly colourway: string;
  readonly group: string | null;
  readonly status: StyleStatus;
  /** How many colourways of this style the plan holds. */
  readonly colourways: number;
  readonly fabricCode: string | null;
  readonly qty: number;
  readonly wholesaleUnits: number;
  readonly d2cUnits: number;
  readonly wholesaleSplitBp: number;
  readonly cost: LandedCost;
  readonly wholesaleMinor: number | null;
  readonly rrpMinor: number | null;
  /** Wholesale units at wholesale, plus D2C units at RRP. Null while a price those units need is unset. */
  readonly revenueMinor: number | null;
  readonly profitMinor: number | null;
  /** The margin in basis points: 4200 is 42%. Null where the revenue or the cost is unknown. */
  readonly marginBp: number | null;
  readonly sizes: readonly LineSizeRow[];
}

export interface PlanTotals {
  readonly units: number;
  readonly styles: number;
  /** The tiers' own total: exactly the price of this basket. Null while any row has no price. */
  readonly tierCostMinor: number | null;
  /** The tiers plus freight and duty. Null while any row has no price. */
  readonly landedCostMinor: number | null;
  readonly freightMinor: number | null;
  readonly dutyMinor: number | null;
  readonly wholesaleRevenueMinor: number | null;
  readonly d2cRevenueMinor: number | null;
  readonly revenueMinor: number | null;
  readonly profitMinor: number | null;
  readonly marginBp: number | null;
  /** The labels of every row the figures came from, each once. */
  readonly labels: readonly string[];
  /** What is not on file, each note once. */
  readonly notes: readonly string[];
}

export interface LinePlan {
  readonly rows: readonly LineRow[];
  readonly totals: PlanTotals;
}

/** The wholesale and D2C units of a quantity. Units are whole pieces; the remainder goes to D2C. */
export function splitUnits(qty: number, wholesaleSplitBp: number): Readonly<{ wholesale: number; d2c: number }> {
  const wholesale = Math.floor((qty * wholesaleSplitBp) / 10_000);
  return { wholesale, d2c: qty - wholesale };
}

/** Units times a price, or null when those units need a price nobody has set. */
const revenueOf = (units: number, priceMinor: number | null): number | null => (units === 0 ? 0 : priceMinor === null ? null : units * priceMinor);

const add = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : a + b);

/** The margin in basis points, or null where either side is unknown or there is no revenue. */
export function marginBpOf(revenueMinor: number | null, costMinor: number | null): number | null {
  if (revenueMinor === null || costMinor === null || revenueMinor <= 0) return null;
  return Math.round(((revenueMinor - costMinor) / revenueMinor) * 10_000);
}

/** The size rows a line expands into, each priced at the same landed unit cost as its line. */
const sizeRowsOf = (style: Style, cost: LandedCost): readonly LineSizeRow[] =>
  style.sizes.map((size) => ({
    label: size.label,
    qty: size.qty,
    landedMinor: cost.status === "landed" ? cost.unitMinor * size.qty : null,
  }));

/** How many colourways each style name has in the plan, by name. */
const colourwaysByName = (styles: readonly Style[]): Readonly<Record<string, number>> => {
  const seen = new Map<string, Set<string>>();
  for (const style of styles) {
    const colourways = seen.get(style.name) ?? new Set<string>();
    colourways.add(style.colourway);
    seen.set(style.name, colourways);
  }
  return Object.fromEntries([...seen].map(([name, colourways]) => [name, colourways.size]));
};

/** One row of the table. The tier is read at `tierQty`: every piece in the plan. */
export function lineRow(
  style: Style,
  plan: CollectionPlan,
  pricing: PricingByStyle,
  tierQty: number,
  colourways: number,
): LineRow {
  const qty = unitsOf(style);
  const priced = pricing[style.id];
  const cost = landedCost({
    ladder: priced?.ladder ?? [],
    qty,
    tierQty: Math.max(tierQty, qty),
    currency: plan.currency,
    rates: priced?.rates ?? noRates(plan.destinationCountry),
  });
  const split = splitUnits(qty, style.wholesaleSplitBp);
  const wholesaleRevenue = revenueOf(split.wholesale, style.wholesaleMinor);
  const d2cRevenue = revenueOf(split.d2c, style.rrpMinor);
  const revenueMinor = add(wholesaleRevenue, d2cRevenue);
  const landed = cost.status === "landed" ? cost.lineMinor : null;
  return {
    styleId: style.id,
    name: style.name,
    colourway: style.colourway,
    group: plan.frames.find((frame) => frame.id === style.frameId)?.name ?? null,
    status: style.status,
    colourways,
    fabricCode: style.fabricCode,
    qty,
    wholesaleUnits: split.wholesale,
    d2cUnits: split.d2c,
    wholesaleSplitBp: style.wholesaleSplitBp,
    cost,
    wholesaleMinor: style.wholesaleMinor,
    rrpMinor: style.rrpMinor,
    revenueMinor,
    profitMinor: revenueMinor === null || landed === null ? null : revenueMinor - landed,
    marginBp: marginBpOf(revenueMinor, landed),
    sizes: sizeRowsOf(style, cost),
  };
}

/** The whole table: a row per style in the plan's order, and the footer totals. */
export function linePlan(plan: CollectionPlan, pricing: PricingByStyle): LinePlan {
  const tierQty = plan.styles.reduce((sum, style) => sum + unitsOf(style), 0);
  const colourways = colourwaysByName(plan.styles);
  const rows = plan.styles.map((style) => lineRow(style, plan, pricing, tierQty, colourways[style.name] ?? 1));
  return { rows, totals: footerTotals(rows) };
}

/** The footer of the table, from the rows above it. */
export function footerTotals(rows: readonly LineRow[]): PlanTotals {
  const sum = (pick: (row: LineRow) => number | null): number | null =>
    rows.reduce<number | null>((total, row) => add(total, pick(row)), 0);
  const tierCostMinor = sum((row) => (row.cost.status === "landed" ? row.cost.tierLineMinor : null));
  const landedCostMinor = sum((row) => (row.cost.status === "landed" ? row.cost.lineMinor : null));
  const wholesaleRevenueMinor = sum((row) => revenueOf(row.wholesaleUnits, row.wholesaleMinor));
  const d2cRevenueMinor = sum((row) => revenueOf(row.d2cUnits, row.rrpMinor));
  const revenueMinor = add(wholesaleRevenueMinor, d2cRevenueMinor);
  return {
    units: rows.reduce((total, row) => total + row.qty, 0),
    styles: rows.length,
    tierCostMinor,
    landedCostMinor,
    freightMinor: sum((row) => (row.cost.status === "landed" ? row.cost.freightUnitMinor * row.qty : null)),
    dutyMinor: sum((row) => (row.cost.status === "landed" ? row.cost.dutyUnitMinor * row.qty : null)),
    wholesaleRevenueMinor,
    d2cRevenueMinor,
    revenueMinor,
    profitMinor: revenueMinor === null || landedCostMinor === null ? null : revenueMinor - landedCostMinor,
    marginBp: marginBpOf(revenueMinor, landedCostMinor),
    labels: [...new Set(rows.flatMap((row) => (row.cost.status === "landed" ? row.cost.labels : [])))],
    notes: [...new Set(rows.flatMap((row) => (row.cost.status === "landed" ? row.cost.notes : [row.cost.reason])))],
  };
}
