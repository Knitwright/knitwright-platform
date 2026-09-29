import { describe, expect, it } from "vitest";
import { panelsFor, pointsOfMeasureFor } from "./applicability";
import { checkCombination } from "./combinations";
import { allCombinations, type Choices } from "./fixtures/combinations";
import { listTypes } from "./registry";
import { TOPS_RULES } from "./registry/tops/rules";

const pointIds = (typeId: string, options: Choices): string[] =>
  pointsOfMeasureFor({ typeId, options }).map((point) => point.id);
const panelIds = (typeId: string, options: Choices): string[] =>
  panelsFor({ typeId, options }).map((panel) => panel.id);
const violatedIds = (typeId: string, options: Choices): string[] =>
  checkCombination(typeId, options).map((violation) => violation.ruleId);

const polo: Choices = {
  fit: "regular",
  neckline: "crew",
  collar: "polo-collar",
  placket: "buttons",
  "sleeve-type": "set-in",
  "sleeve-length": "short",
  "hem-shape": "straight",
  "side-panels": "none",
  cuffs: "none",
};

const jersey: Choices = {
  fit: "regular",
  neckline: "crew",
  collar: "none",
  placket: "none",
  "sleeve-type": "set-in",
  "sleeve-length": "short",
  "hem-shape": "straight",
  "side-panels": "none",
  cuffs: "none",
};

describe("impossible combinations", () => {
  it("accepts a polo with a polo collar and a placket", () => {
    expect(checkCombination("polo", polo)).toEqual([]);
  });

  it("rejects a polo collar with no placket and says why", () => {
    expect(checkCombination("team-jersey", { ...jersey, collar: "band-collar" })).toEqual([]);
    const result = checkCombination("polo", { ...polo, placket: "none" });
    expect(result).toEqual([
      {
        ruleId: "polo-collar-needs-placket",
        reason: "A polo collar folds open at the front, so it needs a placket to fasten the opening.",
      },
    ]);
  });

  it("rejects a placket on a V neck", () => {
    expect(violatedIds("team-jersey", { ...jersey, neckline: "v-neck", placket: "zip" })).toEqual([
      "v-neck-has-no-placket",
    ]);
  });

  it("rejects a band collar on a V neck", () => {
    expect(violatedIds("team-jersey", { ...jersey, neckline: "v-neck", collar: "band-collar" })).toEqual([
      "v-neck-has-no-band-collar",
    ]);
  });

  it("returns every violated rule, not just the first", () => {
    const both = { ...jersey, neckline: "v-neck", collar: "band-collar", placket: "buttons" };
    expect(violatedIds("team-jersey", both)).toEqual([
      "v-neck-has-no-placket",
      "v-neck-has-no-band-collar",
    ]);
  });

  it("ignores options the type does not have", () => {
    expect(violatedIds("crew-tee", { collar: "polo-collar" })).toEqual([]);
  });

  it("finds no violation for an unknown type", () => {
    expect(checkCombination("kilt", polo)).toEqual([]);
  });

  it("gives every rule a reason with no number in it", () => {
    for (const rule of TOPS_RULES) {
      expect(rule.reason.endsWith(".")).toBe(true);
      expect(rule.reason).not.toMatch(/\d/);
    }
  });

  it("matches an independent statement of the rules on every combination of every type", () => {
    let checked = 0;
    for (const { id } of listTypes("tops")) {
      for (const options of allCombinations(id)) {
        const expected = [
          options.collar === "polo-collar" && options.placket === "none" && "polo-collar-needs-placket",
          options.neckline === "v-neck" &&
            (options.placket === "buttons" || options.placket === "zip") &&
            "v-neck-has-no-placket",
          options.neckline === "v-neck" && options.collar === "band-collar" && "v-neck-has-no-band-collar",
        ].filter((entry): entry is string => typeof entry === "string");
        expect(violatedIds(id, options)).toEqual(expected);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("can be broken by at least one combination that some type offers, for every rule", () => {
    const seen = new Set<string>();
    for (const { id } of listTypes("tops")) {
      for (const options of allCombinations(id)) violatedIds(id, options).forEach((rule) => seen.add(rule));
    }
    expect([...seen].sort()).toEqual(TOPS_RULES.map((rule) => rule.id).sort());
  });
});

describe("points of measure that apply", () => {
  it("leaves out collar and placket points on a crew tee", () => {
    const options = { ...jersey };
    expect(pointIds("crew-tee", options)).toEqual([
      "chest-width",
      "body-length",
      "shoulder-width",
      "sleeve-length",
      "armhole",
      "upper-arm",
      "sleeve-opening",
      "hem-width",
      "neck-width",
      "front-neck-drop",
      "back-neck-drop",
    ]);
  });

  it("adds collar height only when there is a collar", () => {
    expect(pointIds("team-jersey", jersey)).not.toContain("collar-height");
    expect(pointIds("team-jersey", { ...jersey, collar: "band-collar" })).toContain("collar-height");
  });

  it("adds placket length and width only when there is a placket", () => {
    expect(pointIds("team-jersey", jersey)).not.toContain("placket-length");
    const withPlacket = pointIds("team-jersey", { ...jersey, placket: "zip" });
    expect(withPlacket).toContain("placket-length");
    expect(withPlacket).toContain("placket-width");
  });

  it("drops shoulder width on a raglan sleeve", () => {
    expect(pointIds("team-jersey", { ...jersey, "sleeve-type": "raglan" })).not.toContain(
      "shoulder-width",
    );
  });

  it("gives a polo all fourteen points", () => {
    expect(pointIds("polo", polo)).toHaveLength(14);
  });

  it("gives no points for an unknown type", () => {
    expect(pointIds("kilt", polo)).toEqual([]);
  });
});

describe("panels that apply", () => {
  const basic = ["body-front", "body-back", "sleeve-left", "sleeve-right"];

  it("gives a plain tee a neckband and no collar", () => {
    expect(panelIds("crew-tee", jersey)).toEqual([...basic, "neckband"]);
  });

  it("swaps the neckband for a collar and adds a placket on a polo", () => {
    expect(panelIds("polo", polo)).toEqual([...basic, "collar", "placket"]);
  });

  it("adds side panels and cuffs when chosen", () => {
    const options = { ...jersey, "side-panels": "contrast-insert", cuffs: "rib-cuff" };
    expect(panelIds("team-jersey", options)).toEqual([...basic, "neckband", "side-panels", "cuffs"]);
  });

  it("gives no panels for an unknown type", () => {
    expect(panelIds("kilt", polo)).toEqual([]);
  });
});
