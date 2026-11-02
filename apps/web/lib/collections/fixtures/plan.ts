import { appTier } from "@/lib/factory/fixtures/rows";
import type { Ladder } from "@/lib/factory/pricing";
import type { CollectionPlan, LandedRates, PricingByStyle, Style } from "../types";
import type { FreightRate, RatesSource } from "../pricing";

/**
 * A collection plan for the tests. Every label says "test", so no figure from here can be mistaken for
 * one a factory, a carrier or a customs adviser agreed.
 */

export const ids = {
  collection: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  core: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  training: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  navy: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  white: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
  tee: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
  product: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
  project: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
} as const;

/** The seeded ladder of migration 20261101050000: 10-19 at 29.00, 20-49 at 25.00, 50+ at 22.00. */
export const jerseyLadder: Ladder = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

export const freightRate: FreightRate = {
  country: "GB",
  perPieceMinor: 120,
  currency: "GBP",
  dutyBasis: "goods_and_freight",
  ruleId: "R-GAP-000",
  label: "Test freight row, not a carrier quote",
};

export const ratesSource: RatesSource = {
  country: "GB",
  freight: freightRate,
  dutyByHs: { "6110.30": 1200 },
  countryLabel: "Test country rule, not a customs opinion",
  countryRuleId: "R-GAP-000",
  hsByArticle: { "JSY-SS-01": "6110.30" },
};

export const gbRates: LandedRates = {
  country: "GB",
  freightPerPieceMinor: 120,
  freightCurrency: "GBP",
  dutyBasis: "goods_and_freight",
  dutyRateBp: 1200,
  hsCode: "6110.30",
  labels: [freightRate.label, "Test country rule, not a customs opinion"],
  ruleIds: ["R-GAP-000"],
};

export const style = (over: Partial<Style> = {}): Style => ({
  id: ids.navy,
  frameId: ids.core,
  productId: ids.product,
  projectId: ids.project,
  name: "Matchday jersey",
  status: "approved",
  colourway: "Navy",
  articleCode: "JSY-SS-01",
  fabricCode: "F-POLY-INT",
  productionClass: "A",
  wholesaleMinor: 4200,
  rrpMinor: 8000,
  wholesaleSplitBp: 6000,
  sizes: [
    { label: "S", qty: 10 },
    { label: "M", qty: 20 },
  ],
  x: 0,
  y: 0,
  ...over,
});

/** Three cards: two colourways of one style in Core, and a tee with no article in Training. */
export const plan = (over: Partial<CollectionPlan> = {}): CollectionPlan => ({
  id: ids.collection,
  name: "Spring drop",
  destinationCountry: "GB",
  currency: "GBP",
  notes: "",
  updatedAt: "2026-11-20T10:00:00Z",
  frames: [
    { id: ids.core, name: "Core", x: 0, y: 0 },
    { id: ids.training, name: "Training", x: 400, y: 0 },
  ],
  styles: [
    style(),
    style({ id: ids.white, colourway: "White", status: "draft", sizes: [{ label: "M", qty: 10 }], wholesaleMinor: null }),
    style({
      id: ids.tee,
      frameId: ids.training,
      name: "Training tee",
      colourway: "Black",
      articleCode: null,
      fabricCode: null,
      productId: null,
      projectId: null,
      sizes: [{ label: "S", qty: 5 }],
    }),
  ],
  ...over,
});

/** Pricing for a plan: the jersey ladder for any style with an article, nothing for the rest. */
export const pricing = (one: CollectionPlan = plan()): PricingByStyle =>
  Object.fromEntries(one.styles.map((card) => [card.id, { ladder: card.articleCode === null ? [] : jerseyLadder, rates: gbRates }]));
