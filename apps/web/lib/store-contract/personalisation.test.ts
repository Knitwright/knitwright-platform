import { describe, expect, it } from "vitest";
import { NAME_PROBLEM } from "@/lib/orders/text";
import { SCREENING, storePersonalisation } from "./personalisation";
import { numberRule, zones } from "./fixtures/samples";

describe("the personalisation rules", () => {
  it("carries every zone with its limit, its note and its rule", () => {
    const rules = storePersonalisation(zones, [numberRule]);
    if (rules.status !== "held") throw new Error("held");

    expect(rules.zones.map((zone) => zone.zone)).toEqual(["back-name", "back-number"]);
    expect(rules.zones[0]?.maxCharacters).toBe(12);
    expect(rules.zones.every((zone) => zone.note.length > 0 && zone.ruleId.startsWith("R-"))).toBe(true);
  });

  it("carries the number ranges by sport, so a reader can look one up", () => {
    const rules = storePersonalisation(zones, [
      { ...numberRule, sport: "rugby" },
      { ...numberRule, sport: "football" },
    ]);
    if (rules.status !== "held") throw new Error("held");

    expect(rules.numbers.map((rule) => rule.sport)).toEqual(["football", "rugby"]);
  });

  it("carries the platform's own character rule, so the Store refuses the same names", () => {
    const rules = storePersonalisation(zones, [numberRule]);
    if (rules.status !== "held") throw new Error("held");

    expect(rules.nameCharacters).toBe(NAME_PROBLEM);
    expect(rules.screening).toBe(SCREENING);
  });

  it("is a gap with no rows, not an empty list, because an empty list reads as no limit", () => {
    expect(storePersonalisation([], [numberRule]).status).toBe("gap");
    expect(storePersonalisation(zones, []).status).toBe("gap");
    const none = storePersonalisation([], []);
    if (none.status !== "gap") throw new Error("gap");
    expect(none.because).toContain("must take no name or number");
  });
});
