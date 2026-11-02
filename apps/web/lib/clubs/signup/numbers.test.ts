import { describe, expect, it } from "vitest";
import { checkNumber, numberHint, numbersOf, type NumberRule } from "./numbers";

const rule = (patch: Partial<NumberRule> = {}): NumberRule => ({
  sport: "default",
  label: "Any sport",
  lowest: 0,
  highest: 99,
  leadingZeroAllowed: true,
  ruleId: "R-GAP-000",
  note: "From the build pack F-T4; no rulebook entry yet",
  ...patch,
});

describe("checkNumber", () => {
  it("takes a number inside the sport's own range, and the digits exactly as typed", () => {
    expect(checkNumber(rule(), "0")).toEqual({ ok: true, number: "0" });
    expect(checkNumber(rule(), " 07 ")).toEqual({ ok: true, number: "07" });
    expect(checkNumber(rule(), "99")).toEqual({ ok: true, number: "99" });
  });

  it("refuses a number the sport does not allow, and says the range in its own words", () => {
    const football = rule({ sport: "football", label: "Football", lowest: 1 });
    const refused = checkNumber(football, "0");

    expect(refused).toMatchObject({ ok: false, ruleId: "R-GAP-000" });
    expect(refused.ok === false && refused.message).toBe("A football number is 1 to 99.");
    expect(checkNumber(rule(), "100").ok).toBe(false);
  });

  it("refuses anything that is not digits", () => {
    for (const typed of ["", " ", "7a", "-1", "1.5", "seven", "١٢"]) {
      expect(checkNumber(rule(), typed).ok, typed).toBe(false);
    }
  });

  it("refuses a leading zero only where the sport does not print one", () => {
    const strict = rule({ sport: "rugby", label: "Rugby", leadingZeroAllowed: false, lowest: 1 });

    expect(checkNumber(strict, "07").ok).toBe(false);
    expect(checkNumber(strict, "7").ok).toBe(true);
    expect(checkNumber(rule(), "07").ok).toBe(true);
  });

  it("carries the rule that explains the refusal, so the player is never told a bare no", () => {
    const own = rule({ ruleId: "R-PER-002" });

    expect(checkNumber(own, "500")).toMatchObject({ ruleId: "R-PER-002" });
  });
});

describe("numberHint", () => {
  it("says what a leading zero does, only where one is kept", () => {
    expect(numberHint(rule())).toContain("07 is printed as 07");
    expect(numberHint(rule({ leadingZeroAllowed: false }))).toBe("0 to 99.");
  });
});

describe("numbersOf", () => {
  it("lists every number of the range, in order", () => {
    expect(numbersOf(rule({ lowest: 7, highest: 10 }))).toEqual(["7", "8", "9", "10"]);
    expect(numbersOf(rule())).toHaveLength(100);
  });
});
