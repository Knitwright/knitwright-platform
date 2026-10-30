import { describe, expect, it } from "vitest";
import { colourwayTally, counters, countersText, groups, sizesOf, totalsPanel, unitsOf } from "./board";
import { ids, plan, style } from "./fixtures/plan";
import { LOOSE_GROUP } from "./vocabulary";

/**
 * Decision 0085: the board's counters of spec F-S10. A card is one style in one colourway, so Styles
 * counts names, Style-colourways counts cards, and SKUs counts the size rows that carry pieces.
 */

describe("counters", () => {
  it("counts styles by name, cards by name and colourway, and SKUs by size", () => {
    expect(counters(plan().styles)).toEqual({ styles: 2, colourways: 3, skus: 4, units: 45 });
  });

  it("counts a size planned at zero as no SKU, because nobody can buy it", () => {
    const cards = [style({ sizes: [{ label: "S", qty: 0 }, { label: "M", qty: 4 }] })];
    expect(counters(cards)).toMatchObject({ skus: 1, units: 4 });
  });

  it("counts nothing for an empty plan", () => {
    expect(counters([])).toEqual({ styles: 0, colourways: 0, skus: 0, units: 0 });
  });

  it("takes a style's quantity from its size rows, never from a figure of its own", () => {
    expect(unitsOf(style())).toBe(30);
    expect(unitsOf(style({ sizes: [] }))).toBe(0);
  });

  it("reads as the line under a frame's name", () => {
    expect(countersText(counters(plan().styles))).toBe("2 styles · 3 style-colourways · 4 SKUs");
    expect(countersText(counters([style({ sizes: [{ label: "M", qty: 1 }] })]))).toBe("1 style · 1 style-colourway · 1 SKU");
  });
});

describe("groups", () => {
  it("gives every frame its own styles and counters", () => {
    const found = groups(plan());
    expect(found.map((group) => [group.name, group.styles, group.colourways, group.skus])).toEqual([
      ["Core", 1, 2, 3],
      ["Training", 1, 1, 1],
    ]);
  });

  it("puts the styles that sit in no frame together, last", () => {
    const one = plan();
    const loose = { ...one, styles: [...one.styles, style({ id: "f0000000-0000-4000-8000-000000000001", frameId: null, name: "Loose" })] };
    const found = groups(loose);
    expect(found.at(-1)).toMatchObject({ frameId: null, name: LOOSE_GROUP, styles: 1 });
  });

  it("shows an empty frame with zero counters rather than hiding it", () => {
    const empty = plan({ styles: [] });
    expect(groups(empty).map((group) => group.skus)).toEqual([0, 0]);
  });
});

describe("the right-hand totals panel", () => {
  it("holds the range, the groups and the colourways", () => {
    const panel = totalsPanel(plan());
    expect(panel.range).toEqual({ styles: 2, colourways: 3, skus: 4, units: 45 });
    expect(panel.groups.map((group) => group.name)).toEqual(["Core", "Training"]);
    expect(panel.colourways.map((tally) => tally.label)).toEqual(["Navy", "Black", "White"]);
  });

  it("orders colourways by SKUs, then by name, and names a card with none", () => {
    const tally = colourwayTally([style({ colourway: "" }), style({ id: ids.white, colourway: "Navy", sizes: [{ label: "M", qty: 1 }] })]);
    expect(tally.map((one) => [one.label, one.skus])).toEqual([
      ["No colourway yet", 2],
      ["Navy", 1],
    ]);
  });

  it("lists the sizes the plan plans, each once and in the order they appear", () => {
    expect(sizesOf(plan().styles)).toEqual(["S", "M"]);
  });
});
