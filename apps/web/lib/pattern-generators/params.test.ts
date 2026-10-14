import { describe, expect, it } from "vitest";
import { camo } from "./generators/camo";
import { geometric } from "./generators/geometric";
import { choiceName, cmText, limitSentence, resolveParams, showValue, valueText } from "./params";

describe("settings", () => {
  it("fills defaults, clamps, and ignores what is not a number", () => {
    expect(resolveParams(camo.params, {})).toEqual({ scale: 60, spread: 0.6, roughness: 0.3 });
    expect(resolveParams(camo.params, { scale: 500, spread: 0, roughness: "x" })).toEqual({ scale: 120, spread: 0.2, roughness: 0.3 });
    expect(resolveParams(camo.params, { scale: Number.NaN }).scale).toBe(60);
    expect(resolveParams(geometric.params, { motif: 1.6 }).motif).toBe(2);
  });

  it("writes values the way a person says them", () => {
    expect(cmText(120)).toBe("12 cm");
    expect(cmText(25)).toBe("2.5 cm");
    expect(valueText(camo.params[0], 60)).toBe("6 cm");
    expect(valueText({ ...camo.params[0], unit: "degrees" }, 45.2)).toBe("45 degrees");
    expect(valueText(camo.params[1], 0.6)).toBe("60 percent");
    expect(valueText({ ...camo.params[0], unit: "yes-no" }, 1)).toBe("yes");
    expect(valueText({ ...camo.params[0], unit: "yes-no" }, 0)).toBe("no");
    expect(valueText({ ...camo.params[0], unit: "count" }, 24)).toBe("24");
    expect(choiceName(geometric.params[0], 1)).toBe("diamonds");
    expect(showValue(geometric.params[0], 3)).toBe("hexagons");
    expect(showValue(camo.params[0], 90)).toBe("9 cm");
  });

  it("says the end of a range in words", () => {
    expect(limitSentence(camo.params[0], "max")).toBe("Largest camo blob is 12 cm.");
    expect(limitSentence(camo.params[0], "min")).toBe("Smallest camo blob is 3 cm.");
    expect(limitSentence({ ...camo.params[1], noun: undefined }, "max")).toBe("Largest how much it covers is 100 percent.");
  });
});
