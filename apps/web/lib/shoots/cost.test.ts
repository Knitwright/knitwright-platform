import { describe, expect, it } from "vitest";
import type { LaunchCostSource } from "@/lib/launch";
import { CREDIT_SETTINGS, PLACEHOLDER_NOTICE } from "@/lib/credits/settings";
import { CHARGING_OFF_NOTE, imageCount, perImageLabel, refundReason, shootCost } from "./cost";
import { SHOOT_GAP_RULE } from "./types";

/**
 * What a shoot costs. The test that matters is the last one: no number in `cost.ts` is a number, so
 * changing the platform's credit price changes the button and nothing in this directory has to be
 * touched.
 */

const source = (perGeneratedBoard: number): LaunchCostSource => ({ perGeneratedBoard, note: PLACEHOLDER_NOTICE, ruleId: SHOOT_GAP_RULE });

describe("the cost on the Generate button", () => {
  it("is the price of one picture times how many were asked for", () => {
    expect(shootCost(3, source(2)).credits).toBe(6);
    expect(shootCost(1, source(2)).credits).toBe(2);
  });

  it("says the count and the cost in words, in the singular where that is right", () => {
    expect(shootCost(1, source(1)).label).toBe("Generate 1 image (1 credit)");
    expect(shootCost(4, source(2)).label).toBe("Generate 4 images (8 credits)");
    expect(perImageLabel(shootCost(4, source(2)))).toBe("2 credits a picture");
    expect(perImageLabel(shootCost(4, source(1)))).toBe("1 credit a picture");
  });

  it("carries the note that says the prices are placeholders, from the credits page itself", () => {
    const cost = shootCost(2, source(1));
    expect(cost.note).toBe(PLACEHOLDER_NOTICE);
    expect(cost.ruleId).toBe(SHOOT_GAP_RULE);
  });

  it("holds the count to one to four wherever it came from", () => {
    expect(imageCount(0)).toBe(1);
    expect(imageCount(9)).toBe(4);
    expect(imageCount("two")).toBe(1);
    expect(imageCount(Number.NaN)).toBe(1);
    expect(shootCost(99, source(1)).count).toBe(4);
  });

  it("never gives a negative cost, whatever an admin typed", () => {
    expect(shootCost(2, source(-5)).credits).toBe(0);
  });

  it("never says charging is on while it is off", () => {
    expect(CHARGING_OFF_NOTE).toMatch(/not being charged/);
  });

  it("writes the same reason on the ledger line as the screen shows", () => {
    expect(refundReason(1)).toMatch(/A shoot of 1 image could not keep the garment/);
    expect(refundReason(4)).toMatch(/4 images/);
  });

  it("is driven by the platform's own credit price, which is a placeholder and not a price", () => {
    expect(CREDIT_SETTINGS.isPlaceholder).toBe(true);
    const cost = shootCost(2, source(CREDIT_SETTINGS.prices.marketing_media));
    expect(cost.perImage).toBe(CREDIT_SETTINGS.prices.marketing_media);
  });
});
