import { describe, expect, it } from "vitest";
import { sampleLadder } from "./fixtures/samples";
import { NO_LADDER, orderSizes, percent, priceRows, pricesAboveCost, sizesOf, unitCost } from "./pricing";

describe("pricing with profit", () => {
  it("reads the cost from the ladder's first tier, the dearest piece, and says so", () => {
    const cost = unitCost(sampleLadder, "GBP");
    expect(cost).toMatchObject({ status: "priced", unitMinor: 1820 });
    expect(cost.status === "priced" && cost.label).toContain("first tier (10-49");
    expect(unitCost(sampleLadder, "AUD")).toMatchObject({ status: "unpriced" });
    expect(unitCost([], "GBP")).toEqual({ status: "unpriced", reason: NO_LADDER });
  });

  it("works out profit and margin per size", () => {
    const rows = priceRows(["S", "M", "3XL"], { S: 4500, "3XL": 1500 }, { status: "priced", unitMinor: 1820, label: "" });
    expect(rows).toEqual([
      { size: "S", costMinor: 1820, retailMinor: 4500, profitMinor: 2680, marginBp: 5956 },
      { size: "M", costMinor: 1820, retailMinor: null, profitMinor: null, marginBp: null },
      { size: "3XL", costMinor: 1820, retailMinor: 1500, profitMinor: -320, marginBp: -2133 },
    ]);
    expect(pricesAboveCost(rows)).toBe(false);
    expect(pricesAboveCost(rows.slice(0, 2))).toBe(true);
    expect(pricesAboveCost([])).toBe(false);
    expect(priceRows(["S"], { S: 4500 }, { status: "unpriced", reason: "" })[0]).toMatchObject({ costMinor: null, profitMinor: null });
  });

  it("says a margin as a percentage", () => {
    expect(percent(5956)).toBe("60%");
    expect(percent(null)).toBe("—");
  });

  it("orders sizes for wearing and keeps the design's own", () => {
    expect(orderSizes(["XL", "S", "3XL", "M", "2XL", "XS"])).toEqual(["XS", "S", "M", "XL", "2XL", "3XL"]);
    expect(orderSizes(["12", "8", "One size", "10"])).toEqual(["8", "10", "12", "One size"]);
    expect(orderSizes(["B", "A"])).toEqual(["A", "B"]);
    expect(sizesOf([" S", "M", "S", ""])).toEqual(["S", "M"]);
  });
});
