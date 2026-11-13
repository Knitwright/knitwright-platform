import { describe, expect, it } from "vitest";
import { hrefOf } from "@/lib/home/targets";
import { START_CARDS } from "./start-cards";

describe("the start cards of Recent", () => {
  it("are d02's five, in its order", () => {
    expect(START_CARDS.map((card) => card.title)).toEqual(["Start a new design", "Browse products and templates", "Mood board", "Range plan", "Repeat print"]);
  });

  it("open the create-new modal, a real page, or nothing yet", () => {
    expect(START_CARDS[0]!.target.kind).toBe("new-design");
    expect(START_CARDS.map((card) => hrefOf(card.target))).toEqual([null, "/products", null, "/orders/plans", null]);
  });

  it("never call a base factory-approved, since every base is a draft until a factory reviews it", () => {
    expect(START_CARDS.every((card) => !/factory-approved/i.test(card.text))).toBe(true);
  });
});
