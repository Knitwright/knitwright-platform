import { counters, unitsOf } from "./board";
import { linePlan } from "./line-plan";
import type { CollectionPlan, PricingByStyle, Style } from "./types";
import { blocker, DROP_IS_A_PAYLOAD, GAP_RULE_ID, SELL_THROUGH, warning, type Finding, type StyleStatus } from "./vocabulary";

/**
 * "Create drop" (spec F-S10): the payload the Knitwright Store collects, and nothing more.
 *
 * This platform builds everything up to the order and hands it over (owner decision 1). So this file
 * writes down what was planned — the styles, their sizes as targets, the prices the plan carries and
 * where the cost figures came from — and it never touches a storefront, a cart, a checkout or a
 * payment. A test holds that: no key and no sentence of a payload may name one.
 */

/** The shape of the payload. Raised when a field changes meaning, so the Store can tell the two apart. */
export const DROP_PAYLOAD_VERSION = 1;

export interface DropSize {
  readonly size: string;
  /** A target, not an order: the Store decides what it opens with. */
  readonly targetQty: number;
}

export interface DropStyle {
  readonly styleId: string;
  readonly name: string;
  readonly colourway: string;
  readonly status: StyleStatus;
  readonly group: string | null;
  readonly articleCode: string | null;
  readonly fabricCode: string | null;
  readonly productionClass: "A" | "B" | null;
  readonly productId: string | null;
  readonly sizes: readonly DropSize[];
  readonly targetUnits: number;
  readonly wholesaleMinor: number | null;
  readonly rrpMinor: number | null;
  /** The landed unit cost the plan showed, or null where no price was on file. */
  readonly unitCostMinor: number | null;
  readonly marginBp: number | null;
}

export interface DropPayload {
  readonly kind: "collection-drop";
  readonly payloadVersion: number;
  readonly collectionId: string;
  readonly collectionName: string;
  readonly destinationCountry: string;
  readonly currency: string;
  readonly generatedAt: string;
  readonly styles: readonly DropStyle[];
  readonly totals: Readonly<{
    styles: number;
    colourways: number;
    skus: number;
    targetUnits: number;
    landedCostMinor: number | null;
    wholesaleRevenueMinor: number | null;
    d2cRevenueMinor: number | null;
    marginBp: number | null;
  }>;
  /** The assumption the margin rests on, word for word from the footer. */
  readonly assumes: string;
  /** What the payload is for, so nobody reads it as an order. */
  readonly handover: string;
  /** The labels of every row the money came from, and what was not on file. */
  readonly labels: readonly string[];
  readonly notes: readonly string[];
}

const sizesOf = (style: Style): readonly DropSize[] =>
  style.sizes.filter((size) => size.qty > 0).map((size) => ({ size: size.label, targetQty: size.qty }));

/** The payload for one plan, built from the same line plan the screen shows. */
export function dropPayload(plan: CollectionPlan, pricing: PricingByStyle, generatedAt: Date): DropPayload {
  const { rows, totals } = linePlan(plan, pricing);
  const range = counters(plan.styles);
  return {
    kind: "collection-drop",
    payloadVersion: DROP_PAYLOAD_VERSION,
    collectionId: plan.id,
    collectionName: plan.name,
    destinationCountry: plan.destinationCountry,
    currency: plan.currency,
    generatedAt: generatedAt.toISOString(),
    styles: plan.styles.map((style, index) => {
      // `linePlan` gives one row per style, in the plan's own order, so the row is always this style's.
      const row = rows[index]!;
      return {
        styleId: style.id,
        name: style.name,
        colourway: style.colourway,
        status: style.status,
        group: row.group,
        articleCode: style.articleCode,
        fabricCode: style.fabricCode,
        productionClass: style.productionClass,
        productId: style.productId,
        sizes: sizesOf(style),
        targetUnits: unitsOf(style),
        wholesaleMinor: style.wholesaleMinor,
        rrpMinor: style.rrpMinor,
        unitCostMinor: row.cost.status === "landed" ? row.cost.unitMinor : null,
        marginBp: row.marginBp,
      };
    }),
    totals: {
      styles: range.styles,
      colourways: range.colourways,
      skus: range.skus,
      targetUnits: totals.units,
      landedCostMinor: totals.landedCostMinor,
      wholesaleRevenueMinor: totals.wholesaleRevenueMinor,
      d2cRevenueMinor: totals.d2cRevenueMinor,
      marginBp: totals.marginBp,
    },
    assumes: SELL_THROUGH,
    handover: DROP_IS_A_PAYLOAD,
    labels: totals.labels,
    notes: totals.notes,
  };
}

/** What stops a drop, and what is worth saying before one is exported. */
export function dropFindings(plan: CollectionPlan): readonly Finding[] {
  const planned = plan.styles.filter((style) => unitsOf(style) > 0);
  const unapproved = plan.styles.filter((style) => style.status === "draft");
  const unpriced = plan.styles.filter((style) => style.rrpMinor === null);
  return [
    plan.styles.length === 0 ? blocker("drop_no_styles", "Add a style to the plan before creating a drop.") : null,
    planned.length === 0 && plan.styles.length > 0
      ? blocker("drop_no_units", "No style has any pieces planned, so the drop would carry no targets.")
      : null,
    unapproved.length > 0
      ? warning("drop_draft_styles", `${unapproved.length} of ${plan.styles.length} styles are still drafts. They go into the payload with that status.`)
      : null,
    unpriced.length > 0
      ? warning("drop_no_rrp", `${unpriced.length} styles have no RRP yet, so the Store gets no retail price for them.`, GAP_RULE_ID)
      : null,
  ].filter((found): found is Finding => found !== null);
}

/** True when a drop may be exported: no blocker among the findings. */
export const canExportDrop = (findings: readonly Finding[]): boolean => !findings.some((found) => found.severity === "blocker");
