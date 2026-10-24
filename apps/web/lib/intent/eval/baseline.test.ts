import { describe, expect, it } from "vitest";
import { baselineReading } from "./baseline";

describe("baselineReading (the vocabulary matcher, no model)", () => {
  it("finds one article", () => {
    expect(baselineReading("football shirt in navy").prediction).toEqual({ kind: "article", articleId: "team-jersey" });
  });
  it("lists several articles instead of choosing", () => {
    const { prediction } = baselineReading("jersey and shorts");
    expect(prediction).toEqual({ kind: "ambiguous", candidates: ["team-jersey", "shorts"] });
  });
  it("ignores an article the person refused", () => {
    expect(baselineReading("not a polo, a crew neck tee").prediction).toEqual({ kind: "article", articleId: "crew-tee" });
  });
  it("declines when no article is named, and offers no nearest block", () => {
    expect(baselineReading("a wetsuit").prediction).toEqual({ kind: "decline" });
  });
  it("returns the colours it can read", () => {
    expect(baselineReading("hoodie in navy and gold").colours).toEqual(["#1b2a49", "#f2b705"]);
  });
});
