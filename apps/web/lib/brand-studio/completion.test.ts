import { describe, expect, it } from "vitest";
import { completionOf, stillToDo, WEIGHT_SOURCE } from "./completion";
import { asset, finishedRecord, palette, record } from "./fixtures/brand";
import { EMPTY_PROFILE } from "./types";
import { FONT_ROLES } from "./words";

/** The completion % of F-S9. It counts only what the brand has said. */

describe("completionOf", () => {
  it("is 0 for a brand that has said nothing", () => {
    const completion = completionOf(record());
    expect(completion.percent).toBe(0);
    expect(completion.steps.every((step) => !step.done)).toBe(true);
  });

  it("is 100 for a brand that has filled every part F-S9 asks for", () => {
    expect(completionOf(finishedRecord()).percent).toBe(100);
  });

  it("names its steps in the order the Overview shows them", () => {
    expect(completionOf(record()).steps.map((step) => step.key)).toEqual([
      "details",
      "logos",
      "colours",
      "fonts",
      "graphics",
      "style",
      "sportswear",
    ]);
  });

  it("counts a palette, not a colour, on the Colours card", () => {
    const completion = completionOf(record({ palettes: [palette({ id: "p1" }), palette({ id: "p2" })] }));
    expect(completion.steps.find((step) => step.key === "colours")).toMatchObject({ done: true, count: 2 });
  });

  it("asks for all five font roles before Fonts is done", () => {
    const four = FONT_ROLES.slice(0, 4).map((role) => ({ role, fontKey: "geist" }));
    expect(completionOf(record({ fonts: four })).steps.find((step) => step.key === "fonts")).toMatchObject({ done: false, count: 4 });
    expect(completionOf(record({ fonts: [...four, { role: "name_number", fontKey: "geist" }] })).steps.find((step) => step.key === "fonts")?.done).toBe(true);
  });

  it("does not count a role that is there with no font chosen", () => {
    const empty = FONT_ROLES.map((role) => ({ role, fontKey: null }));
    expect(completionOf(record({ fonts: empty })).steps.find((step) => step.key === "fonts")).toMatchObject({ done: false, count: 0 });
  });

  it("counts a visual-style text only once it holds words, not spaces", () => {
    const spaces = record({ profile: { ...EMPTY_PROFILE, style: { setting: "   ", artDirection: "", rulesBoundaries: "" } } });
    expect(completionOf(spaces).steps.find((step) => step.key === "style")).toMatchObject({ done: false, count: 0 });
  });

  it("asks for a crest and a size range before Sportswear is done", () => {
    const crestOnly = record({ assets: [asset("crest")] });
    expect(completionOf(crestOnly).steps.find((step) => step.key === "sportswear")?.done).toBe(false);
    const both = record({ assets: [asset("crest")], profile: { ...EMPTY_PROFILE, defaultSizeRange: ["M"] } });
    expect(completionOf(both).steps.find((step) => step.key === "sportswear")?.done).toBe(true);
  });

  it("counts a palette read through from the club kit, because it is a real value", () => {
    const readThrough = record({ palettes: [palette({ id: "club-kit", source: "club-kit" })] });
    expect(completionOf(readThrough).steps.find((step) => step.key === "colours")?.done).toBe(true);
  });

  it("gives a whole number between 0 and 100 for every part-done brand", () => {
    const some = record({ palettes: [palette()], assets: [asset("logo")] });
    const { percent } = completionOf(some);
    expect(Number.isInteger(percent)).toBe(true);
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
  });

  it("says where its weights came from, and claims nothing for them", () => {
    expect(WEIGHT_SOURCE).toContain("not reviewed by anyone");
  });
});

describe("stillToDo", () => {
  it("lists what is left, with what each step asks for", () => {
    const left = stillToDo(completionOf(record({ palettes: [palette()] })));
    expect(left.map((step) => step.key)).not.toContain("colours");
    expect(left.every((step) => step.asks !== "")).toBe(true);
  });

  it("lists nothing for a finished brand", () => {
    expect(stillToDo(completionOf(finishedRecord()))).toEqual([]);
  });
});
