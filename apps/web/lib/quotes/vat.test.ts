import { describe, expect, it } from "vitest";
import { countryRule } from "./fixtures/quote";
import { inclusionsFor, NAMES_NOTE, NO_NAMES_NOTE, sponsorNote } from "./inclusions";
import { dayPart, quoteNumber, referenceFor, validUntil } from "./number";
import { GAP_RULE_ID, NOT_KNOWN, QUOTE_SETTINGS } from "./settings";
import { MARKET_CLOSED, NO_COUNTRY_RULE, PRICES_AS_STORED, ruleForCountry, vatTreatment } from "./vat";

describe("the VAT treatment of a quote", () => {
  it("states the market's own rate and that no tax is added to any figure", () => {
    const treatment = vatTreatment(countryRule());
    expect(treatment).toMatchObject({ country: "GB", countryName: "United Kingdom", rate: "20%", ruleId: GAP_RULE_ID });
    expect(treatment.text).toContain("20%");
    expect(treatment.text).toContain(PRICES_AS_STORED);
    expect(treatment.label).toContain("to confirm with a customs adviser");
  });

  it("never shows a price as carrying a tax nobody is registered for, which is O3's own rule", () => {
    // Nobody has registered Knitwright for a tax anywhere (decision 0104), so the line says so and
    // the rate is the one that applies once somebody does.
    const treatment = vatTreatment(countryRule({ taxRegistered: false }));
    expect(treatment.text).toContain("Prices carry no VAT");
    expect(treatment.text).toContain("once it is");
    expect(vatTreatment(countryRule({ taxRegistered: true })).text).toContain("VAT of 20% is charged");
  });

  it("says plainly that it knows nothing when no market rule could be read", () => {
    expect(vatTreatment(null)).toMatchObject({ country: null, countryName: NOT_KNOWN, rate: NOT_KNOWN, text: NO_COUNTRY_RULE, ruleId: GAP_RULE_ID });
  });

  it("says plainly that a closed market has no treatment, rather than showing a rate", () => {
    const closed = vatTreatment(countryRule({ country: "US", name: "United States", sellingEnabled: false, vatRateBp: null }));
    expect(closed).toMatchObject({ rate: NOT_KNOWN, text: MARKET_CLOSED("United States") });
  });

  it("says plainly that no rate is set, rather than taking one as nought", () => {
    const none = vatTreatment(countryRule({ vatRateBp: null }));
    expect(none.rate).toBe(NOT_KNOWN);
    expect(none.text).toContain("a rate nobody has recorded");
    expect(none.text).toContain("as stored");
  });

  it("says plainly that nobody has recorded which tax a market charges", () => {
    const none = vatTreatment(countryRule({ taxName: null }));
    expect(none.rate).toBe("20%");
    expect(none.text).toContain("Nobody has recorded which tax");
  });

  it("reads a rate in basis points as a percentage a person reads", () => {
    expect(vatTreatment(countryRule()).rate).toBe("20%");
    expect(vatTreatment(countryRule({ vatRateBp: 1050 })).rate).toBe("10.5%");
    expect(vatTreatment(countryRule({ vatRateBp: 0 })).rate).toBe("0%");
  });

  it("falls back to the gap rule where the row names none", () => {
    expect(vatTreatment(countryRule({ ruleId: "" })).ruleId).toBe(GAP_RULE_ID);
    expect(vatTreatment(countryRule({ sellingEnabled: false, ruleId: "" })).ruleId).toBe(GAP_RULE_ID);
    expect(vatTreatment(countryRule({ vatRateBp: null, ruleId: "" })).ruleId).toBe(GAP_RULE_ID);
    expect(vatTreatment(countryRule({ ruleId: "R-LAB-002" })).ruleId).toBe(GAP_RULE_ID);
  });

  it("finds the row for a market, and nothing for one no row covers", () => {
    const rules = [countryRule(), countryRule({ country: "AU", name: "Australia", currency: "AUD" })];
    expect(ruleForCountry(rules, "AU")?.name).toBe("Australia");
    expect(ruleForCountry(rules, "NZ")).toBeNull();
  });
});

describe("the quote number", () => {
  it("is the day and a reference for what is being quoted", () => {
    const at = new Date("2026-11-02T23:30:00.000Z");
    expect(dayPart(at)).toBe("20261102");
    expect(dayPart(new Date("2026-01-05T00:00:00.000Z"))).toBe("20260105");
    expect(quoteNumber(at, { clubName: "Rovers", sportId: "football", currency: "GBP", lines: [{ articleCode: "JSY-SS-01", qty: 20 }] })).toMatch(
      /^KWQ-20261102-[A-Z2-9]{6}$/,
    );
  });

  it("gives the same reference for the same text and a different one for a changed character", () => {
    expect(referenceFor("rovers|football")).toBe(referenceFor("rovers|football"));
    expect(referenceFor("rovers|football")).not.toBe(referenceFor("rovers|footbalm"));
    expect(referenceFor("", 4)).toHaveLength(4);
    expect(referenceFor("abc")).toHaveLength(QUOTE_SETTINGS.referenceLength);
  });

  it("uses no character that can be read as another", () => {
    for (const text of ["a", "bb", "ccc", "dddd", "club rovers", "20 shirts"]) expect(referenceFor(text)).not.toMatch(/[IO01]/);
  });

  it("is good for thirty days, counted in whole days", () => {
    expect(validUntil(new Date("2026-11-02T23:59:00.000Z"))).toBe("2026-12-02");
    expect(validUntil(new Date("2026-11-02T00:00:00.000Z"), 1)).toBe("2026-11-03");
  });
});

describe("what a quote says is included", () => {
  it("names the crest, the sponsors and the names and numbers, each with its rule", () => {
    const lines = inclusionsFor({ crest: true, sponsors: 2, namesNumbers: true });
    expect(lines.map((one) => one.id)).toEqual(["crest", "sponsors", "names-numbers"]);
    expect(lines.every((one) => one.included)).toBe(true);
    expect(lines[1]!.note).toBe(sponsorNote(2));
    expect(lines[2]!.note).toBe(NAMES_NOTE);
  });

  it("says a thing is not on the kit rather than leaving its line out", () => {
    const lines = inclusionsFor({ crest: false, sponsors: 0, namesNumbers: false });
    expect(lines).toHaveLength(3);
    expect(lines.every((one) => !one.included)).toBe(true);
    expect(lines[0]!.note).toContain("No crest is on this kit yet");
    expect(lines[1]!.note).toContain("No sponsor marks");
    expect(lines[2]!.note).toBe(NO_NAMES_NOTE);
  });

  it("never shows a per-piece price for names and numbers, because none is agreed", () => {
    expect(NAMES_NOTE).toContain("Knitwright placeholder");
    expect(NAMES_NOTE).not.toMatch(/[£$]/);
    expect(sponsorNote(1)).toBe("1 sponsor mark is printed in the same pass as the shirt, so it adds nothing to the price.");
    expect(sponsorNote(3)).toBe("3 sponsor marks are printed in the same pass as the shirt, so they add nothing to the price.");
  });
});
