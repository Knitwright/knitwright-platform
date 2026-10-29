import { describe, expect, it } from "vitest";
import type { PriceTier } from "@/lib/factory/schemas";
import { lineMinorOf, NO_LADDER, priceStep, priceSteps, stepLabels } from "./prices";

const tier = (qtyMin: number, qtyMax: number | null, sellGbpMinor: number | null, label = "Placeholder club price from the build pack, not a factory quote"): PriceTier => ({
  id: "00000000-0000-4000-8000-000000000000",
  capabilityId: "00000000-0000-4000-8000-000000000001",
  qtyMin,
  qtyMax,
  cost: null,
  sellGbpMinor,
  sellAudMinor: null,
  personalisationCostMinor: null,
  ruleId: "R-COST-003",
  label,
});

/** The seeded club ladder (decision 0071): 10-19, 20-49 and 50+, in GBP only. */
const SEEDED = [tier(10, 19, 2900), tier(20, 49, 2500), tier(50, null, 2200)];

describe("the price at 1, 50 and 100", () => {
  it("prices the quantities the ladder covers, and labels where the figure came from", () => {
    const [one, fifty, hundred] = priceSteps(SEEDED, "GBP");
    expect(one?.result.status).toBe("below-tiers");
    expect(fifty?.result.status).toBe("priced");
    expect(hundred?.result.status).toBe("priced");
    expect(fifty?.text).toContain("per piece at 50 pieces");
    expect(fifty?.label).toContain("not a factory quote");
  });

  it("says a quantity below the smallest tier is not covered, instead of inventing a price", () => {
    const step = priceStep(SEEDED, 1, "GBP");
    expect(step.text).toContain("The smallest tier starts at 10");
    expect(step.label).toBeNull();
    expect(lineMinorOf(step.result)).toBeNull();
  });

  it("says no price is on file when the article has no ladder", () => {
    expect(priceStep([], 50, "GBP").text).toBe(NO_LADDER);
  });

  it("says a currency with no price set is not set, for the seeded ladder in Australian dollars", () => {
    const step = priceStep(SEEDED, 50, "AUD");
    expect(step.result.status).toBe("not-set");
    expect(step.text).toContain("AUD");
  });

  it("keeps money in whole minor units", () => {
    const step = priceStep(SEEDED, 100, "GBP");
    expect(step.result.status === "priced" && step.result.unitMinor).toBe(2200);
    expect(lineMinorOf(step.result)).toBe(220_000);
  });

  it("gives each tier label once", () => {
    expect(stepLabels(priceSteps(SEEDED, "GBP"))).toHaveLength(1);
    expect(stepLabels(priceSteps([], "GBP"))).toEqual([]);
  });

  it("reads the quantities it is given, in order", () => {
    expect(priceSteps(SEEDED, "GBP", [20, 10]).map((step) => step.qty)).toEqual([20, 10]);
  });
});
