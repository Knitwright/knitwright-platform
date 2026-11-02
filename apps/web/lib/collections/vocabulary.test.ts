import { describe, expect, it } from "vitest";
import { createCollectionBody, saveStyleBody } from "./schemas";
import {
  blocker,
  COLOURS_NOT_READ,
  DROP_IS_A_PAYLOAD,
  GAP_RULE_ID,
  LINE_PLAN_COLUMNS,
  percent,
  pieces,
  SELL_THROUGH,
  splitText,
  STYLE_STATUS_LABELS,
  STYLE_STATUSES,
  styleWord,
  UNIT_COST_IS,
  warning,
} from "./vocabulary";

/**
 * Decision 0085: the words of F-S10, and what the screens may be sent. The wording rules of the
 * platform apply: nothing here states a price, a rate or a delivery as a fact, and the two sentences
 * the spec writes word for word are kept word for word.
 */

describe("the words", () => {
  it("holds the four statuses and the eleven columns the spec lists, in its order", () => {
    expect(STYLE_STATUSES).toEqual(["draft", "sampling", "approved", "ordered"]);
    expect(Object.values(STYLE_STATUS_LABELS)).toEqual(["Draft", "Sampling", "Approved", "Ordered"]);
    expect(LINE_PLAN_COLUMNS).toEqual([
      "Style",
      "Group",
      "Status",
      "Colourways",
      "Fabric",
      "Qty",
      "Split (Wholesale / D2C)",
      "Unit cost",
      "Wholesale",
      "RRP",
      "Margin",
    ]);
  });

  it("keeps the footer's assumption word for word", () => {
    expect(SELL_THROUGH).toBe("Assumes full-price sell-through");
  });

  it("says what a unit cost is made of, and never calls it a quote", () => {
    expect(UNIT_COST_IS).toContain("plus freight and duty to the destination");
    expect(`${UNIT_COST_IS} ${COLOURS_NOT_READ}`).not.toMatch(/quote|guarantee|final price/i);
  });

  it("says a drop is a payload for the Store and that nothing is charged here", () => {
    expect(DROP_IS_A_PAYLOAD).toContain("payload");
    expect(DROP_IS_A_PAYLOAD).toContain("targets, not orders");
    expect(DROP_IS_A_PAYLOAD).not.toMatch(/cart|checkout|publish/i);
  });

  it("counts in words", () => {
    expect([pieces(1), pieces(2)]).toEqual(["1 piece", "2 pieces"]);
    expect([styleWord(1), styleWord(4)]).toEqual(["1 style", "4 styles"]);
    expect(splitText(6000)).toBe("60% wholesale · 40% D2C");
    expect(splitText(0)).toBe("0% wholesale · 100% D2C");
    expect([percent(1250), percent(5000)]).toEqual(["12.5", "50"]);
  });

  it("puts a rule id on every finding, R-GAP-000 where the rulebook has no entry", () => {
    expect(blocker("x", "Nope")).toEqual({ code: "x", severity: "blocker", message: "Nope", ruleId: GAP_RULE_ID });
    expect(warning("y", "Careful", "R-COST-003")).toMatchObject({ severity: "warning", ruleId: "R-COST-003" });
  });
});

describe("what the screens may send", () => {
  it("takes a plan's name, destination and currency, and refuses anything else as a currency", () => {
    expect(createCollectionBody.safeParse({ name: " Spring drop ", destinationCountry: "GB", currency: "GBP" }).data?.name).toBe("Spring drop");
    expect(createCollectionBody.safeParse({ name: "A", destinationCountry: "GB", currency: "USD" }).success).toBe(false);
    expect(createCollectionBody.safeParse({ name: "A", destinationCountry: "gb", currency: "GBP" }).success).toBe(false);
  });

  it("takes money only as whole minor units", () => {
    const body = (over: Record<string, unknown>) => saveStyleBody.safeParse({ collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Jersey", ...over });
    expect(body({ rrpMinor: 8000 }).success).toBe(true);
    expect(body({ rrpMinor: 80.5 }).success).toBe(false);
    expect(body({ rrpMinor: -1 }).success).toBe(false);
    expect(body({ wholesaleSplitBp: 10_001 }).success).toBe(false);
  });

  it("defaults a new style to a draft in no group with no sizes", () => {
    const parsed = saveStyleBody.parse({ collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Jersey" });
    expect(parsed).toMatchObject({ status: "draft", frameId: null, styleId: null, sizes: {}, wholesaleSplitBp: 0, colourway: "" });
  });

  it("refuses an article code or a fabric code that is not one", () => {
    const body = (over: Record<string, unknown>) => saveStyleBody.safeParse({ collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Jersey", ...over });
    expect(body({ articleCode: "jersey" }).success).toBe(false);
    expect(body({ articleCode: "JSY-SS-01" }).success).toBe(true);
    expect(body({ fabricCode: "cotton" }).success).toBe(false);
    expect(body({ fabricCode: "F-POLY-INT" }).success).toBe(true);
  });
});
