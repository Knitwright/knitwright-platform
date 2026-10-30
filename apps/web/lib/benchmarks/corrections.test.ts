import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { applyCorrection, correctionSchema, minorUnitsOf } from "./corrections";
import { card, runningShort } from "./fixtures/cards";

/** The confirm-and-correct step (spec F-S2 step 4): a person's words are theirs, and clearing a field is honest. */

const read = (raw: Record<string, unknown>) => correctionSchema.parse(raw);

describe("minorUnitsOf", () => {
  it("reads a price as a person types it", () => {
    expect(minorUnitsOf("45")).toBe(4500);
    expect(minorUnitsOf("45.50")).toBe(4550);
    expect(minorUnitsOf("45,5")).toBe(4550);
    expect(minorUnitsOf("£38.99")).toBe(3899);
    expect(minorUnitsOf(" 60 ")).toBe(6000);
  });

  it("reads nothing out of words that are not a price", () => {
    for (const bad of ["", "free", "45.999", "forty five", "-5"]) expect(minorUnitsOf(bad), bad).toBeNull();
  });
});

describe("applyCorrection", () => {
  it("leaves a field alone when the correction does not mention it", () => {
    const corrected = applyCorrection(runningShort(), read({ fit: "Regular" }));

    expect(corrected.productName).toEqual(runningShort().productName);
    expect(corrected.fit).toEqual({ value: "Regular", provenance: "observed", corrected: true });
  });

  it("says a corrected field came from the person, not from the page", () => {
    const corrected = applyCorrection(runningShort(), read({ brandName: "Acme Sport" }));

    expect(corrected.brandName).toMatchObject({ value: "Acme Sport", corrected: true });
  });

  it("takes an empty box as not known, rather than leaving a wrong value in place", () => {
    const corrected = applyCorrection(runningShort(), read({ fabricComposition: "", gsm: "", sizeRange: "" }));

    expect(corrected.fabricComposition).toEqual({ value: null, provenance: "unknown", corrected: true });
    expect(corrected.gsm).toEqual({ value: null, provenance: "unknown", corrected: true });
    expect(corrected.sizeRange).toEqual({ value: null, provenance: "unknown", corrected: true });
  });

  it("reads a typed price and keeps the currency it had when none is given", () => {
    const corrected = applyCorrection(runningShort(), read({ price: "38.99" }));

    expect(corrected.price.value).toEqual({ minor: 3899, currency: "GBP" });
  });

  it("takes a currency the person chose", () => {
    const corrected = applyCorrection(runningShort(), read({ price: "60", currency: "eur" }));

    expect(corrected.price.value).toEqual({ minor: 6000, currency: "EUR" });
  });

  it("takes a price it cannot read as not known rather than storing a number nobody stated", () => {
    const corrected = applyCorrection(runningShort(), read({ price: "about forty" }));

    expect(corrected.price).toEqual({ value: null, provenance: "unknown", corrected: true });
  });

  it("reads sizes as a person lists them", () => {
    const corrected = applyCorrection(runningShort(), read({ sizeRange: "XS, S, M / L" }));

    expect(corrected.sizeRange.value).toEqual(["XS", "S", "M", "L"]);
  });

  it("takes a fabric weight outside what a knit fabric can be as not known", () => {
    expect(applyCorrection(runningShort(), read({ gsm: "4" })).gsm.value).toBeNull();
    expect(applyCorrection(runningShort(), read({ gsm: "180" })).gsm.value).toBe(180);
  });

  it("adds a feature the person ticked as theirs, and drops one they unticked", () => {
    const corrected = applyCorrection(runningShort(), read({ features: ["zip_back_pocket", "side_split"] }));

    expect(corrected.features).toEqual([
      { key: "zip_back_pocket", provenance: "observed", corrected: false },
      { key: "side_split", provenance: "observed", corrected: true },
    ]);
  });

  it("reads one ticked box as a list of one", () => {
    const corrected = applyCorrection(card(), read({ features: "side_split" }));

    expect(corrected.features.map((feature) => feature.key)).toEqual(["side_split"]);
  });

  it("ignores a feature key the taxonomy does not know", () => {
    expect(applyCorrection(card(), read({ features: ["not_a_feature"] })).features).toEqual([]);
  });

  it("refuses a correction that carries markup: nothing out of a page's source is ever stored", () => {
    expect(() => applyCorrection(runningShort(), read({ productName: "<b>Speedshort</b>" }))).toThrow(AppError);
  });

  it("cuts a very long correction to the length the card takes, rather than refusing it", () => {
    const corrected = applyCorrection(runningShort(), read({ fit: "x".repeat(120) }));

    expect(corrected.fit.value).toHaveLength(120);
  });

  it("refuses words longer than the schema takes at the door", () => {
    expect(correctionSchema.safeParse({ fit: "x".repeat(400) }).success).toBe(false);
  });
});
