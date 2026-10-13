import { describe, expect, it } from "vitest";
import { BUYER_KINDS, buyerKindLabel, defaultBuyerKind } from "./buyer-kind";
import { guidedStartWithKindSchema } from "./guided-start";

describe("guidedStartWithKindSchema", () => {
  it("takes the path together with the way to start", () => {
    expect(guidedStartWithKindSchema.parse({ buyerKind: "team_kit", method: "sketch" })).toEqual({
      buyerKind: "team_kit",
      method: "sketch",
    });
    expect(
      guidedStartWithKindSchema.parse({ buyerKind: "launch_brand", method: "text", sentence: " A polo " }),
    ).toEqual({ buyerKind: "launch_brand", method: "text", sentence: "A polo" });
  });

  it("asks for the path first when none is chosen", () => {
    const result = guidedStartWithKindSchema.safeParse({ method: "sketch" });

    expect(result.error?.issues.map((issue) => [issue.path, issue.message])).toEqual([
      [["buyerKind"], "Choose which path fits you first."],
    ]);
  });
});

describe("defaultBuyerKind", () => {
  it("keeps the path the brand took before", () => {
    expect(defaultBuyerKind({ organisationType: "club", segment: "creator_merch" })).toBe("creator_merch");
  });

  it("starts a club, school, gym or event on team kit, and a brand on launching a brand", () => {
    for (const type of ["club", "school", "gym", "event"]) {
      expect(defaultBuyerKind({ organisationType: type, segment: null })).toBe("team_kit");
    }
    expect(defaultBuyerKind({ organisationType: "brand", segment: null })).toBe("launch_brand");
  });

  it("chooses nothing when the brand has not said who it is", () => {
    expect(defaultBuyerKind({ organisationType: null, segment: null })).toBe("");
    expect(defaultBuyerKind({ organisationType: "other", segment: null })).toBe("");
  });
});

describe("BUYER_KINDS", () => {
  it("offers the four paths of the guide, in its words", () => {
    expect(BUYER_KINDS.map((kind) => kind.label)).toEqual(["Team kit", "Launch a brand", "Creator merch", "Upload my design"]);
    expect(buyerKindLabel("creator_merch")).toBe("Creator merch");
    expect(buyerKindLabel(null)).toBe("Not given");
  });
});
