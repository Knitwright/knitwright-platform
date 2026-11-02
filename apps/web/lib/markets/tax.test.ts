import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appRule } from "./fixtures/rules";
import { marketPhrase, taxTreatment } from "./tax";

/**
 * The GST trigger, against the only figure a source in this repository states, and against the rule that
 * nothing is shown as charged while nobody is registered (decision 0103).
 */

const MIGRATION = join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261210030000_australia_and_translate.sql");

describe("what a market charges on a sale", () => {
  it("says Australia's price carries no GST, because nobody is registered for it", () => {
    const treatment = taxTreatment(appRule());
    expect(treatment.state).toBe("not-registered");
    expect(treatment.name).toBe("GST");
    expect(treatment.rate).toBe("10%");
    expect(treatment.line).toBe("Prices carry no GST: Knitwright is not registered for GST in Australia. GST of 10% applies once it is.");
    expect(treatment.missing).toBe("Registered above A$75,000.00 of sales.");
    expect(treatment.source).toContain("Confirm with a tax adviser");
  });

  it("charges the tax only once the row says the seller is registered", () => {
    const treatment = taxTreatment(appRule({ taxRegistered: true }));
    expect(treatment.state).toBe("charged");
    expect(treatment.line).toBe("GST of 10% is charged in Australia.");
    expect(treatment.missing).toBeNull();
  });

  it("names the rate as missing rather than guessing one, registered or not", () => {
    expect(taxTreatment(appRule({ vatRateBp: null })).line).toContain("GST at a rate nobody has recorded");
    const charged = taxTreatment(appRule({ vatRateBp: null, taxRegistered: true }));
    expect(charged.line).toBe("GST is charged in Australia at a rate nobody has recorded.");
    expect(charged.missing).toBe("No GST rate is recorded for Australia.");
  });

  it("says nothing at all about a market whose row names no tax", () => {
    const treatment = taxTreatment(appRule({ country: "US", name: "United States", taxName: null, vatRateBp: null, taxRegistrationThresholdMinor: null, taxSource: null }));
    expect(treatment.state).toBe("not-recorded");
    // "the United States", not "United States": the name reads after a preposition.
    expect(treatment.line).toBe("Nobody has recorded which tax the United States charges on a sale.");
    expect(treatment.missing).toContain("Ask a tax adviser");
    expect(treatment.threshold).toBeNull();
  });

  it("names the threshold as missing rather than inventing one", () => {
    expect(taxTreatment(appRule({ taxRegistrationThresholdMinor: null, taxSource: null })).missing).toBe(
      "No GST registration threshold is recorded for Australia.",
    );
  });

  it("writes a rate of 20% as 20%, not 20.00%", () => {
    expect(taxTreatment(appRule({ currency: "GBP", taxName: "VAT", vatRateBp: 2000 })).rate).toBe("20%");
    expect(taxTreatment(appRule({ vatRateBp: 1750 })).rate).toBe("17.5%");
  });

  it("carries R-GAP-000, because no rulebook entry covers a tax", () => {
    expect(taxTreatment(appRule()).ruleId).toBe("R-GAP-000");
  });

  it("writes a market's name the way it reads after a preposition", () => {
    expect(marketPhrase("Australia")).toBe("Australia");
    expect(marketPhrase("United Kingdom")).toBe("the United Kingdom");
    expect(marketPhrase("European Union")).toBe("the European Union");
  });
});

describe("the figures the migration seeds", () => {
  const migration = readFileSync(MIGRATION, "utf8");

  it("seeds Australia's GST threshold as the one figure a source here states, with that source", () => {
    expect(migration).toContain("tax_registration_threshold_minor = 7500000");
    expect(migration).toContain("offshore sellers register for GST above AUD 75,000 in sales");
    expect(migration).toContain("docs/spec/research/Knitwright platform validation.md");
  });

  it("registers Knitwright for nothing, anywhere", () => {
    expect(migration).not.toMatch(/tax_registered = true/u);
    expect(migration).toContain("tax_registered boolean not null default false");
  });

  it("refuses a threshold with no source, in the database itself", () => {
    expect(migration).toContain("add constraint country_rules_threshold_has_a_source");
  });

  it("writes no AUD price and says why", () => {
    expect(migration).toContain("sell_aud_minor = null");
    expect(migration).toContain("No AUD price: the build pack gives GBP only.");
  });
});
