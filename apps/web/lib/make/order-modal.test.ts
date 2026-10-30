import { describe, expect, it } from "vitest";
import type { PriceTier } from "@/lib/factory/schemas";
import { chipsFor, describeTotal, earliestReadyBy, filterProducts, lineKey, priceSelection, type OrderProduct, type Quantities } from "./order-modal";

const tier = (qtyMin: number, qtyMax: number | null, sell: number | null): PriceTier => ({
  id: `00000000-0000-4000-8000-00000000000${qtyMin % 10}`,
  capabilityId: "00000000-0000-4000-8000-000000000001",
  qtyMin,
  qtyMax,
  cost: null,
  sellGbpMinor: sell,
  sellAudMinor: null,
  personalisationCostMinor: null,
  ruleId: "R-COST-003",
  label: "Placeholder club price from the build pack, not a factory quote",
});

const LADDER = [tier(10, 19, 2900), tier(20, 49, 2500), tier(50, null, 2200)];

const product = (over: Partial<OrderProduct> = {}): OrderProduct => ({
  productId: "p1",
  projectId: "pj1",
  name: "Fern jersey",
  articleCode: "JSY-SS-01",
  productionClass: "A",
  sizes: ["S", "M"],
  ladder: LADDER,
  readyBy: "2026-11-21",
  madeBy: "Made by Knitwright · Sialkot",
  colourway: "Home",
  ...over,
});

const typed = (entries: readonly (readonly [string, string, string])[]): Quantities =>
  Object.fromEntries(entries.map(([id, size, qty]) => [lineKey(id, size), qty]));

describe("searching my products", () => {
  const products = [product(), product({ productId: "p2", name: "Oak shorts", articleCode: "SHO-TR-01", colourway: "Away" })];

  it("matches on the name, the article code and the colourway", () => {
    expect(filterProducts(products, "oak", "all").map((p) => p.productId)).toEqual(["p2"]);
    expect(filterProducts(products, "JSY", "all").map((p) => p.productId)).toEqual(["p1"]);
    expect(filterProducts(products, "away", "all").map((p) => p.productId)).toEqual(["p2"]);
    expect(filterProducts(products, "  ", "all")).toHaveLength(2);
  });
});

describe("the chips", () => {
  it("offers All, each class and a date the factory data can give", () => {
    const chips = chipsFor([product(), product({ productId: "p2", productionClass: "B" })]);
    expect(chips.map((chip) => chip.id)).toEqual(["all", "class-a", "class-b", "ready-by"]);
    expect(chips.every((chip) => chip.available)).toBe(true);
    expect(chips[3]?.label).toContain("2026-11-21");
  });

  it("switches off a class no product has, and the date chip when no date is set", () => {
    const chips = chipsFor([product({ productionClass: null, readyBy: null })]);
    expect(chips.find((chip) => chip.id === "class-a")?.available).toBe(false);
    expect(chips.find((chip) => chip.id === "class-b")?.available).toBe(false);
    expect(chips.find((chip) => chip.id === "ready-by")).toMatchObject({ available: false, label: "Ready to ship by: no date yet" });
  });

  it("filters by class and by the earliest date on file", () => {
    const products = [product(), product({ productId: "p2", productionClass: "B", readyBy: "2026-12-01" })];
    expect(earliestReadyBy(products)).toBe("2026-11-21");
    expect(filterProducts(products, "", "class-b").map((p) => p.productId)).toEqual(["p2"]);
    expect(filterProducts(products, "", "ready-by").map((p) => p.productId)).toEqual(["p1"]);
    expect(filterProducts([product({ readyBy: null })], "", "ready-by")).toEqual([]);
  });
});

describe("the rows and the total", () => {
  it("reads the tier at every piece in the basket, not at one line", () => {
    const products = [product(), product({ productId: "p2", name: "Oak shorts" })];
    const selection = priceSelection(products, typed([["p1", "M", "30"], ["p2", "S", "30"]]), "GBP");
    expect(selection.tierQty).toBe(60);
    expect(selection.pieces).toBe(60);
    // 60 pieces in the basket falls in the 50+ tier, although neither line reaches 50 on its own.
    expect(selection.products[0]?.rows.find((row) => row.size === "M")?.lineMinor).toBe(2200 * 30);
    expect(selection.totalMinor).toBe(2200 * 60);
    expect(describeTotal(selection)).toContain("60 pieces");
  });

  it("recalculates when a quantity changes", () => {
    const first = priceSelection([product()], typed([["p1", "M", "15"]]), "GBP");
    const more = priceSelection([product()], typed([["p1", "M", "25"]]), "GBP");
    expect(first.totalMinor).toBe(2900 * 15);
    expect(more.totalMinor).toBe(2500 * 25);
  });

  it("gives no total while a line has no price on file, and never a zero", () => {
    const selection = priceSelection([product({ ladder: [] })], typed([["p1", "M", "20"]]), "GBP");
    expect(selection.totalMinor).toBeNull();
    expect(selection.products[0]?.rows[1]?.lineMinor).toBeNull();
    expect(selection.products[0]?.rows[1]?.unitText).toContain("No price ladder");
    expect(describeTotal(selection)).toContain("No total yet");
  });

  it("says nothing is selected when no quantity is typed", () => {
    const selection = priceSelection([product()], {}, "GBP");
    expect(selection.pieces).toBe(0);
    expect(selection.canSend).toBe(false);
    expect(describeTotal(selection)).toBe("Nothing selected yet.");
  });

  it("refuses a Class B style outside 50 to 300 pieces, as the run page does", () => {
    const selection = priceSelection([product({ productionClass: "B" })], typed([["p1", "M", "20"]]), "GBP");
    expect(selection.canSend).toBe(false);
    expect(selection.findings.map((f) => f.code)).toContain("class_b_quantity");
    expect(selection.pieces).toBe(20);
  });

  it("lets a Class A style be ordered from one piece, with the price the tiers give", () => {
    const selection = priceSelection([product()], typed([["p1", "S", "1"]]), "GBP");
    expect(selection.canSend).toBe(true);
    expect(selection.totalMinor).toBeNull();
    expect(selection.products[0]?.rows[0]?.unitText).toContain("The smallest tier starts at 10");
  });
});
