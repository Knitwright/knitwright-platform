import { describe, expect, it } from "vitest";
import { suggestedOwner } from "./routing";

const lead = { owner: null, country: "AU", organisationType: "club", score: 60 } as const;

describe("suggestedOwner", () => {
  it("sends an Australian club of 60 or more to the partner", () => {
    expect(suggestedOwner(lead)).toBe("partner");
  });

  it("keeps an owner the lead already has", () => {
    expect(suggestedOwner({ ...lead, owner: "knitwright" })).toBe("knitwright");
    expect(suggestedOwner({ ...lead, owner: "partner", score: 10 })).toBe("partner");
  });

  it("keeps brands, creators and buyers overseas with Knitwright", () => {
    expect(suggestedOwner({ ...lead, organisationType: "brand" })).toBe("knitwright");
    expect(suggestedOwner({ ...lead, organisationType: null })).toBe("knitwright");
    expect(suggestedOwner({ ...lead, country: "NZ" })).toBe("knitwright");
  });

  it("suggests nobody below 60", () => {
    expect(suggestedOwner({ ...lead, score: 59 })).toBeNull();
  });
});
