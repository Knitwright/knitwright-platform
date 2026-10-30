import type { Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import type { StyleStatus } from "./vocabulary";

/**
 * What a collection plan is, as the board, the line plan and the drop payload all see it (plan v5 Z4,
 * spec F-S10; decision 0085). Types only, and no zod, so a client component may import them.
 *
 * Money is integer minor units in the collection's own currency. Null is "not set", never zero: a style
 * with no retail price has no margin, and the plan says so rather than showing 100%.
 */

/** Pieces planned for one size. The style's quantity is the sum of these, never a figure of its own. */
export interface PlannedSize {
  readonly label: string;
  readonly qty: number;
}

/** A named group on the dotted canvas. */
export interface Frame {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

/** One style card: one style in one colourway. */
export interface Style {
  readonly id: string;
  readonly frameId: string | null;
  /** The product the brand has listed, when there is one. A sample can only be ordered against a product. */
  readonly productId: string | null;
  readonly projectId: string | null;
  readonly name: string;
  readonly status: StyleStatus;
  readonly colourway: string;
  readonly articleCode: string | null;
  readonly fabricCode: string | null;
  readonly productionClass: "A" | "B" | null;
  readonly wholesaleMinor: number | null;
  readonly rrpMinor: number | null;
  /** The wholesale share of the planned units, in basis points: 6000 is 60% wholesale. */
  readonly wholesaleSplitBp: number;
  readonly sizes: readonly PlannedSize[];
  readonly x: number;
  readonly y: number;
}

export interface CollectionPlan {
  readonly id: string;
  readonly name: string;
  readonly destinationCountry: string;
  readonly currency: SellCurrency;
  readonly notes: string;
  readonly frames: readonly Frame[];
  readonly styles: readonly Style[];
  readonly updatedAt: string;
}

/** A collection as the index lists it: no styles read, only the counts. */
export interface CollectionSummary {
  readonly id: string;
  readonly name: string;
  readonly destinationCountry: string;
  readonly currency: SellCurrency;
  readonly styles: number;
  readonly units: number;
  readonly updatedAt: string;
}

/**
 * What it costs to land a piece at the destination, from rows: the freight row of
 * `collection_freight_rates` and the duty rate of `country_rules.duty_by_hs` for the article's HS code.
 * Null always means "no row says", and the landed cost then says what is missing.
 */
export interface LandedRates {
  readonly country: string;
  readonly freightPerPieceMinor: number | null;
  /** The currency the freight row is in. Freight is only added when it matches the plan's currency. */
  readonly freightCurrency: string | null;
  readonly dutyBasis: "goods" | "goods_and_freight";
  /** Duty in basis points for this article's HS code, or null where no rate is on file. */
  readonly dutyRateBp: number | null;
  readonly hsCode: string | null;
  /** The labels of the rows the figures came from, shown beside every landed cost. */
  readonly labels: readonly string[];
  readonly ruleIds: readonly string[];
}

/** The price ladder of one style, with the rates for its article. */
export interface StylePricing {
  readonly ladder: Ladder;
  readonly rates: LandedRates;
}

/** Every style's pricing, by style id. A style with no entry has no price on file. */
export type PricingByStyle = Readonly<Record<string, StylePricing>>;
