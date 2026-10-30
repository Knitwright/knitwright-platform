import { describe, expect, it } from "vitest";
import { toCapability, toTier } from "@/lib/factory/rows";
import { capabilityRows, factoryRow, tierRows } from "@/lib/factory/fixtures/rows";
import { toFactory } from "@/lib/factory/rows";
import type { FactorySnapshot } from "@/lib/factory/schemas";
import { articleCodesOf, emptyRates, emptySource, ladderFor, pricingFor, ratesFor } from "./pricing";
import { plan, ratesSource, style } from "./fixtures/plan";

/**
 * Decision 0085: every figure in the line plan comes from a row. This file holds the joining: the
 * ladder is the capability's tiers, the duty rate is the country rule read at the article's HS code,
 * and the freight is the destination's freight row. Nothing invents a number for a missing row.
 */

const snapshot: FactorySnapshot = {
  factory: toFactory(factoryRow),
  capabilities: capabilityRows.map(toCapability),
  tiers: tierRows.map(toTier),
  fabrics: [],
};

describe("ratesFor", () => {
  it("reads the duty rate at the article's HS code", () => {
    expect(ratesFor(ratesSource, "JSY-SS-01")).toMatchObject({ hsCode: "6110.30", dutyRateBp: 1200, freightPerPieceMinor: 120, dutyBasis: "goods_and_freight" });
  });

  it("has no duty for a style with no article, and none for an article with no HS code", () => {
    expect(ratesFor(ratesSource, null)).toMatchObject({ hsCode: null, dutyRateBp: null });
    expect(ratesFor(ratesSource, "SHO-TR-01")).toMatchObject({ hsCode: null, dutyRateBp: null });
  });

  it("has no duty where the destination has no rate for that HS code", () => {
    expect(ratesFor({ ...ratesSource, dutyByHs: {} }, "JSY-SS-01")).toMatchObject({ hsCode: "6110.30", dutyRateBp: null });
  });

  it("carries the label of every row it read, and a rule id for each", () => {
    const rates = ratesFor(ratesSource, "JSY-SS-01");
    expect(rates.labels).toEqual(["Test freight row, not a carrier quote", "Test country rule, not a customs opinion"]);
    expect(rates.ruleIds).toEqual(["R-GAP-000"]);
  });

  it("says nothing is on file for a destination with no rows", () => {
    expect(ratesFor(emptySource("US"), "JSY-SS-01")).toMatchObject({ country: "US", freightPerPieceMinor: null, dutyRateBp: null, labels: [] });
    expect(emptyRates("US")).toMatchObject({ country: "US", freightCurrency: null });
  });
});

describe("ladderFor", () => {
  it("gives the tiers of the capability for the style's article and fabric", () => {
    expect(ladderFor(snapshot, style()).map((tier) => tier.qtyMin)).toEqual([10, 20, 50]);
  });

  it("gives no ladder for a style with no article, no factory, or an article the factory does not make", () => {
    expect(ladderFor(snapshot, style({ articleCode: null }))).toEqual([]);
    expect(ladderFor(null, style())).toEqual([]);
    expect(ladderFor(snapshot, style({ articleCode: "ZZZ-ZZ-01" }))).toEqual([]);
  });

  it("falls back to the capability's own fabric where the style names none", () => {
    expect(ladderFor(snapshot, style({ fabricCode: null }))).toHaveLength(3);
  });
});

describe("pricingFor", () => {
  it("gives every style a ladder and the destination's rates", () => {
    const pricing = pricingFor(plan().styles, snapshot, ratesSource);
    expect(Object.keys(pricing)).toHaveLength(3);
    expect(pricing[plan().styles[0]!.id]!.ladder).toHaveLength(3);
    expect(pricing[plan().styles[2]!.id]!.ladder).toEqual([]);
  });

  it("names the article codes a plan needs an HS code for, each once", () => {
    expect(articleCodesOf(plan().styles)).toEqual(["JSY-SS-01"]);
    expect(articleCodesOf([])).toEqual([]);
  });
});
