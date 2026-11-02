import { describe, expect, it } from "vitest";
import { priceBasket } from "@/lib/factory/pricing";
import { unitsOf } from "./board";
import { footerTotals, linePlan, marginBpOf, splitUnits } from "./line-plan";
import { ids, jerseyLadder, plan, pricing, style } from "./fixtures/plan";

/**
 * The acceptance test of spec F-S10: changing a quantity re-prices the line from the current tiers, and
 * the totals match the price of the same basket to the penny. Decision 0085.
 *
 * Every row here is priced by `landedCost`, whose tier part is `priceFor`; the footer adds those tier
 * lines up untouched, which is what `priceBasket` does for a basket. So the two agree by construction,
 * and the first test below is what proves it did not stop being true.
 */

/** A plan where every style has an article, so the whole basket has a price. */
const priced = () => plan({ styles: plan().styles.filter((card) => card.articleCode !== null) });

describe("the totals and the basket agree to the penny", () => {
  it("adds the tier lines up to exactly priceFor of the same basket", () => {
    const one = priced();
    const { totals } = linePlan(one, pricing(one));
    const basket = priceBasket(
      one.styles.map((card) => ({ articleCode: card.articleCode!, qty: unitsOf(card), ladder: jerseyLadder })),
      "GBP",
    );
    expect(basket.totalMinor).not.toBeNull();
    expect(totals.tierCostMinor).toBe(basket.totalMinor);
  });

  it("agrees at every quantity, including the one that crosses a tier", () => {
    for (const qty of [10, 19, 20, 49, 50, 120]) {
      const one = plan({ styles: [style({ sizes: [{ label: "M", qty }] })] });
      const { totals } = linePlan(one, pricing(one));
      const basket = priceBasket([{ articleCode: "JSY-SS-01", qty, ladder: jerseyLadder }], "GBP");
      expect([qty, totals.tierCostMinor]).toEqual([qty, basket.totalMinor]);
    }
  });

  it("re-prices live when a quantity changes: one more piece can move the whole plan to the next tier", () => {
    const at19 = plan({ styles: [style({ sizes: [{ label: "M", qty: 19 }] })] });
    const at20 = plan({ styles: [style({ sizes: [{ label: "M", qty: 20 }] })] });
    expect(linePlan(at19, pricing(at19)).rows[0]!.cost).toMatchObject({ tierUnitMinor: 2900 });
    expect(linePlan(at20, pricing(at20)).rows[0]!.cost).toMatchObject({ tierUnitMinor: 2500 });
  });

  it("counts the tier across the whole plan, not line by line (spec F-T5)", () => {
    const two = plan({ styles: [style({ sizes: [{ label: "M", qty: 30 }] }), style({ id: ids.white, colourway: "White", sizes: [{ label: "M", qty: 30 }] })] });
    const { rows } = linePlan(two, pricing(two));
    // 60 pieces in the plan: both lines are priced at the 50+ tier, though neither reaches 50 alone.
    expect(rows.map((row) => row.cost.status === "landed" && row.cost.tierUnitMinor)).toEqual([2200, 2200]);
  });

  it("adds the landed total on top of the tier total, which is the freight and the duty", () => {
    const one = priced();
    const { totals } = linePlan(one, pricing(one));
    expect(totals.landedCostMinor).toBe(totals.tierCostMinor! + totals.freightMinor! + totals.dutyMinor!);
  });
});

describe("a row of the table", () => {
  it("names the style, its group, its status, its colourways and its fabric", () => {
    const { rows } = linePlan(plan(), pricing());
    expect(rows[0]).toMatchObject({ name: "Matchday jersey", group: "Core", status: "approved", colourways: 2, fabricCode: "F-POLY-INT", qty: 30 });
    expect(rows.find((row) => row.name === "Training tee")).toMatchObject({ group: "Training", colourways: 1 });
  });

  it("expands into size rows, each at the same landed unit cost as its line", () => {
    const { rows } = linePlan(plan(), pricing());
    const row = rows[0]!;
    expect(row.sizes).toEqual([
      { label: "S", qty: 10, landedMinor: 2934 * 10 },
      { label: "M", qty: 20, landedMinor: 2934 * 20 },
    ]);
    expect(row.sizes.reduce((sum, size) => sum + (size.landedMinor ?? 0), 0)).toBe(row.cost.status === "landed" ? row.cost.lineMinor : null);
  });

  it("splits the units into wholesale and D2C, whole pieces only", () => {
    expect(splitUnits(30, 6000)).toEqual({ wholesale: 18, d2c: 12 });
    expect(splitUnits(7, 5000)).toEqual({ wholesale: 3, d2c: 4 });
    expect(splitUnits(30, 0)).toEqual({ wholesale: 0, d2c: 30 });
    expect(splitUnits(30, 10_000)).toEqual({ wholesale: 30, d2c: 0 });
  });

  it("works the revenue, the profit and the margin out of the split and the prices", () => {
    const { rows } = linePlan(plan(), pricing());
    const row = rows[0]!;
    expect(row).toMatchObject({ wholesaleUnits: 18, d2cUnits: 12, revenueMinor: 18 * 4200 + 12 * 8000 });
    expect(row.profitMinor).toBe(row.revenueMinor! - 2934 * 30);
    expect(row.marginBp).toBe(Math.round((row.profitMinor! / row.revenueMinor!) * 10_000));
  });

  it("has no revenue and no margin where a price those units need is not set", () => {
    const { rows } = linePlan(plan(), pricing());
    const white = rows.find((row) => row.colourway === "White")!;
    expect([white.wholesaleUnits, white.wholesaleMinor]).toEqual([6, null]);
    expect([white.revenueMinor, white.profitMinor, white.marginBp]).toEqual([null, null, null]);
  });

  it("has no cost and no margin where the style has no price on file", () => {
    const { rows } = linePlan(plan(), pricing());
    const tee = rows.find((row) => row.name === "Training tee")!;
    expect(tee.cost.status).toBe("no-price");
    expect([tee.profitMinor, tee.marginBp]).toEqual([null, null]);
    expect(tee.sizes.every((size) => size.landedMinor === null)).toBe(true);
  });

  it("has no price at all for a style the pricing does not cover", () => {
    const { rows, totals } = linePlan(plan(), {});
    expect(rows.every((row) => row.cost.status === "no-price")).toBe(true);
    expect([totals.tierCostMinor, totals.landedCostMinor]).toEqual([null, null]);
  });

  it("counts no wholesale revenue where every unit is D2C", () => {
    const one = plan({ styles: [style({ wholesaleSplitBp: 0, wholesaleMinor: null })] });
    const { rows, totals } = linePlan(one, pricing(one));
    expect([rows[0]!.wholesaleUnits, rows[0]!.revenueMinor]).toEqual([0, 30 * 8000]);
    expect(totals.wholesaleRevenueMinor).toBe(0);
  });

  it("gives no group for a style that sits in no frame", () => {
    const loose = plan({ styles: [style({ frameId: null })] });
    expect(linePlan(loose, pricing(loose)).rows[0]!.group).toBeNull();
  });
});

describe("the footer", () => {
  it("counts the units and the styles, and leaves every money total unknown while a row has no price", () => {
    const { totals } = linePlan(plan(), pricing());
    expect([totals.units, totals.styles]).toEqual([45, 3]);
    expect([totals.tierCostMinor, totals.landedCostMinor, totals.profitMinor, totals.marginBp]).toEqual([null, null, null, null]);
  });

  it("splits the revenue into wholesale and D2C", () => {
    const one = plan({ styles: [style()] });
    const { totals } = linePlan(one, pricing(one));
    expect([totals.wholesaleRevenueMinor, totals.d2cRevenueMinor]).toEqual([18 * 4200, 12 * 8000]);
    expect(totals.revenueMinor).toBe(18 * 4200 + 12 * 8000);
  });

  it("carries every label once and every note once", () => {
    const { totals } = linePlan(plan(), pricing());
    expect(totals.labels).toEqual([
      "Test row, not a factory quote",
      "Test freight row, not a carrier quote",
      "Test country rule, not a customs opinion",
    ]);
    expect(totals.notes).toEqual(["No price is on file for this style's article yet."]);
  });

  it("totals nothing for an empty plan, and shows no margin against no revenue", () => {
    expect(footerTotals([])).toMatchObject({ units: 0, styles: 0, tierCostMinor: 0, marginBp: null });
    expect(marginBpOf(0, 0)).toBeNull();
    expect(marginBpOf(null, 10)).toBeNull();
    expect(marginBpOf(10, null)).toBeNull();
    expect(marginBpOf(10_000, 6_000)).toBe(4000);
  });
});
