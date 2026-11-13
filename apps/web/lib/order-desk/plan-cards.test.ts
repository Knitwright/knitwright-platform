import { describe, expect, it } from "vitest";
import type { LineRow } from "@/lib/collections/line-plan";
import { LADDER, tier } from "./fixtures/ladder";
import { MOVED_TO_ORDERS } from "./moved";
import { moqOf, NOT_SET, styleFacts } from "./plan-cards";

const landed = { status: "landed", unitMinor: 2850 } as unknown as LineRow["cost"];

describe("a range plan card's facts", () => {
  it("reads the MOQ from the priced tiers and the target cost from the line plan", () => {
    expect(moqOf(LADDER, "GBP")).toBe(1);
    expect(moqOf([tier(10, null, 2000)], "GBP")).toBe(10);
    expect(moqOf(LADDER, "AUD")).toBeNull();
    expect(styleFacts({ cost: landed } as LineRow, [tier(10, null, 2000)], "GBP", "F-POLY-INT")).toEqual({ fabric: "F-POLY-INT", moq: "10 pieces", targetCost: "£28.50" });
  });

  it("says what is not set", () => {
    expect(styleFacts(undefined, [], "GBP", null)).toEqual({ fabric: NOT_SET, moq: NOT_SET, targetCost: NOT_SET });
  });
});

describe("the moved collection plans", () => {
  it("redirect every old address into Orders for good", () => {
    expect(MOVED_TO_ORDERS.every((route) => route.permanent && route.destination.startsWith("/orders/"))).toBe(true);
  });
});
