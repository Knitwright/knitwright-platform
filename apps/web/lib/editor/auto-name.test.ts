import { describe, expect, it } from "vitest";
import { autoDesignName, shortLabel } from "./index";
import { bare, jersey } from "./fixtures/article";

describe("the name a design takes from its form", () => {
  it("names each chosen option, as the spec writes it", () => {
    expect(autoDesignName(jersey(), { options: {}, parameters: {} })).toBe("Crew neck · Coverstitch hem · Plain");
  });

  it("adds every parameter moved off the article's default", () => {
    const named = autoDesignName(jersey(), { options: { collar: "C02" }, parameters: { body_length_offset: 20, back_drop_tail: 0 } });

    expect(named).toBe("V-neck · Coverstitch hem · Plain · Body length +20 mm");
  });

  it("is nothing for a design with no base article, and nothing is invented for it", () => {
    expect(autoDesignName(null, { options: {}, parameters: {} })).toBeNull();
    expect(autoDesignName(bare(), { options: {}, parameters: {} })).toBeNull();
  });
});

describe("shortLabel", () => {
  it("takes the first clause of a catalogue label", () => {
    expect(shortLabel("Crew neck, 1x1 rib, 20 mm finished")).toBe("Crew neck");
    expect(shortLabel("Plain")).toBe("Plain");
  });
});
