import { describe, expect, it } from "vitest";
import { NOT_YET_SAMPLED, RULE_ID } from "@/lib/catalogue";
import { bare, jersey, withSample } from "./fixtures/article";
import {
  chosenOption,
  defaultForm,
  defaultsOver,
  humanise,
  notSampled,
  optionGroups,
  parameterSliders,
  parameterValue,
  resolveForm,
  signedMm,
  withinRange,
} from "./form";

/**
 * The Form toolbar against the seeded catalogue (X1): nothing it offers comes from code, and
 * nothing outside a factory-approved option or range can be reached (plan v5, "manufacturable by
 * construction").
 */

const EMPTY = { options: {}, parameters: {} } as const;

describe("humanise", () => {
  it("drops the drafter's jargon and writes the key as words", () => {
    expect(humanise("body_length_offset")).toBe("Body length");
    expect(humanise("sleeve_finish")).toBe("Sleeve finish");
    expect(humanise("back_drop_tail")).toBe("Back drop tail");
    expect(humanise("collar")).toBe("Collar");
  });

  it("keeps a key it cannot turn into words", () => {
    expect(humanise("_")).toBe("_");
  });
});

describe("signedMm", () => {
  it("writes a shortening with a typographic minus", () => {
    expect(signedMm(20)).toBe("+20 mm");
    expect(signedMm(-30)).toBe("−30 mm");
    expect(signedMm(0)).toBe("+0 mm");
  });
});

describe("option groups", () => {
  it("offers every group of the article with its catalogue codes, the default chosen", () => {
    const groups = optionGroups(jersey(), EMPTY);

    expect(groups.map((group) => group.group)).toEqual(["collar", "sleeve_finish", "pattern_fill"]);
    expect(groups[0]?.label).toBe("Collar");
    expect(groups[0]?.tiles.map((tile) => tile.code)).toEqual(["C01", "C02", "C03"]);
    expect(groups[0]?.chosen).toBe("C01");
    expect(groups[1]?.chosen).toBe("K01");
  });

  it("keeps the choice a person made, and ignores a code the article does not offer", () => {
    const article = jersey();

    expect(optionGroups(article, { ...EMPTY, options: { collar: "C02" } })[0]?.chosen).toBe("C02");
    expect(optionGroups(article, { ...EMPTY, options: { collar: "C99" } })[0]?.chosen).toBe("C01");
  });

  it("marks an option no sample has signed off, and only that one", () => {
    const groups = optionGroups(withSample(jersey(), "C02", "body_length_offset"), EMPTY);
    const collar = groups[0]?.tiles ?? [];

    expect(collar.find((tile) => tile.code === "C02")?.notSampled).toBe(false);
    expect(collar.find((tile) => tile.code === "C02")?.lockNote).toBeNull();
    expect(collar.find((tile) => tile.code === "C01")?.notSampled).toBe(true);
    expect(collar.find((tile) => tile.code === "C01")?.lockNote).toBe(NOT_YET_SAMPLED);
  });

  it("gives every tile a rule a Why? can resolve", () => {
    for (const group of optionGroups(jersey(), EMPTY)) {
      for (const tile of group.tiles) expect(tile.ruleId).toMatch(RULE_ID);
    }
  });

  it("shows no price for an option nobody has priced", () => {
    const tiles = optionGroups(jersey(), EMPTY).flatMap((group) => group.tiles);

    expect(tiles.every((tile) => tile.extraCost === null)).toBe(true);
  });

  it("shows the extra cost of a priced option", () => {
    const article = jersey();
    const priced = { ...article, options: article.options.map((option) => (option.code === "C02" ? { ...option, extraCostMinor: 250, currency: "GBP" } : option)) };

    expect(optionGroups(priced, EMPTY)[0]?.tiles.find((tile) => tile.code === "C02")?.extraCost).toBe("+£2.50");
  });

  it("offers nothing for an article whose options the build pack does not give", () => {
    expect(optionGroups(bare(), EMPTY)).toEqual([]);
    expect(chosenOption([], undefined)).toBeNull();
  });
});

describe("parameter sliders", () => {
  it("shows the approved range beside the value, as the spec writes it", () => {
    const sliders = parameterSliders(jersey(), { ...EMPTY, parameters: { body_length_offset: 20 } });
    const body = sliders.find((slider) => slider.key === "body_length_offset");

    expect(body?.rangeLabel).toBe("Body length +20 mm · range −30 to +40");
    expect(body).toMatchObject({ min: -30, max: 40, step: 10, value: 20, defaultMm: 0, unit: "mm" });
  });

  it("names the points of measure the parameter moves", () => {
    expect(parameterSliders(jersey(), EMPTY).find((slider) => slider.key === "body_length_offset")?.pomLetters).toEqual(["B"]);
  });

  it("writes a range that starts at nought without a sign", () => {
    expect(parameterSliders(jersey(), EMPTY).find((slider) => slider.key === "back_drop_tail")?.rangeLabel).toBe("Back drop tail +0 mm · range 0 to +40");
  });

  it("marks a range no sample has signed off", () => {
    const sliders = parameterSliders(withSample(jersey(), "C02", "body_length_offset"), EMPTY);

    expect(sliders.find((slider) => slider.key === "body_length_offset")?.notSampled).toBe(false);
    expect(sliders.find((slider) => slider.key === "sleeve_length_offset")?.lockNote).toBe(NOT_YET_SAMPLED);
  });
});

describe("withinRange", () => {
  const body = { min: -30, max: 40, step: 10 };

  it("takes the ends of the range and every step between them", () => {
    for (const value of [-30, -20, 0, 20, 40]) expect(withinRange(body, value)).toBe(true);
  });

  it("refuses anything outside the range, between steps, or not a number", () => {
    for (const value of [-40, 41, 15, Number.NaN, Number.POSITIVE_INFINITY]) expect(withinRange(body, value)).toBe(false);
  });

  it("allows any value where the article names no end or step", () => {
    expect(withinRange({ min: null, max: null, step: null }, 1234)).toBe(true);
    expect(withinRange({ min: 0, max: 10, step: 0 }, 3)).toBe(true);
  });
});

describe("parameterValue", () => {
  const def = jersey().parameters.find((entry) => entry.key === "body_length_offset");

  it("takes the person's value when the article offers it", () => {
    expect(parameterValue(def!, 20)).toBe(20);
  });

  it("falls back to the article's default for a value it does not", () => {
    expect(parameterValue(def!, 15)).toBe(0);
    expect(parameterValue(def!, undefined)).toBe(0);
  });

  it("falls back to nought where the default is not a number", () => {
    expect(parameterValue({ ...def!, defaultValue: "wide" }, undefined)).toBe(0);
  });
});

describe("the form a design starts in", () => {
  it("is every group's default option and every range's default value", () => {
    expect(defaultForm(jersey())).toEqual({
      options: { collar: "C01", sleeve_finish: "K01", pattern_fill: "P00" },
      parameters: { body_length_offset: 0, sleeve_length_offset: 0, back_drop_tail: 0 },
    });
  });

  it("is empty without a base article", () => {
    expect(defaultForm(null)).toEqual(EMPTY);
  });
});

describe("resolveForm", () => {
  it("reads the address's text and keeps only what the article offers", () => {
    const form = resolveForm(jersey(), { options: { collar: "C03", shoes: "Z01" }, parameters: { body_length_offset: "-20", back_drop_tail: "17", sleeve_length_offset: "nine" } });

    expect(form.options).toEqual({ collar: "C03", sleeve_finish: "K01", pattern_fill: "P00" });
    expect(form.parameters).toEqual({ body_length_offset: -20, sleeve_length_offset: 0, back_drop_tail: 0 });
  });

  it("is empty without a base article", () => {
    expect(resolveForm(null, { options: { collar: "C03" }, parameters: {} })).toEqual(EMPTY);
  });

  it("drops an unknown key when a form is laid over the article's defaults", () => {
    expect(defaultsOver(jersey(), { options: { hat: "H01" }, parameters: { nothing: 5 } })).toEqual(defaultForm(jersey()));
  });
});

describe("what no sample has signed off", () => {
  it("lists the chosen option of every group and every range moved off its default", () => {
    const found = notSampled(jersey(), { options: { collar: "C02" }, parameters: { body_length_offset: 20 } });

    expect(found.map((entry) => entry.label)).toEqual(["Collar C02", "Sleeve finish K01", "Pattern fill P00", "Body length +20 mm"]);
    for (const entry of found) expect(entry.ruleId).toMatch(RULE_ID);
  });

  it("says nothing about a range left where the article drafts it", () => {
    expect(notSampled(jersey(), EMPTY).map((entry) => entry.label)).toEqual(["Collar C01", "Sleeve finish K01", "Pattern fill P00"]);
  });

  it("says nothing at all without a base article", () => {
    expect(notSampled(null, EMPTY)).toEqual([]);
  });
});
