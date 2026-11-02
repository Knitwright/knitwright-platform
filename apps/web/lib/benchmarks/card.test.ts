import { describe, expect, it } from "vitest";
import { cardClaims, cardFeatures, cardFields, cardThemes, line, NOT_KNOWN, PROVENANCE_MARKS } from "./card";
import { card, fromPhoto, runningShort } from "./fixtures/cards";
import { emptyCard } from "./schema";

/**
 * The one rule this file's code exists for (spec F-S2 step 4): a value is never shown without saying how it is known,
 * and an inferred value is never shown as a fact.
 */

describe("cardFields", () => {
  it("says how every field is known, on every field, with no exceptions", () => {
    for (const field of cardFields(runningShort())) {
      expect(field.how, field.name).not.toBe("");
      expect(line(field)).toContain(field.how);
    }
  });

  it("shows a stated field as stated and an unknown one as not known", () => {
    const fields = cardFields(runningShort());
    const price = fields.find((field) => field.name === "price");

    expect(price).toMatchObject({ value: "£45.00", provenance: "observed", how: "stated on the page", mark: "obs" });
    expect(cardFields(emptyCard()).every((field) => field.value === NOT_KNOWN && field.how === "not known")).toBe(true);
  });

  it("never shows an inferred value as stated: it says it was read off the picture", () => {
    const name = cardFields(fromPhoto()).find((field) => field.name === "productName");

    expect(name).toMatchObject({ value: "Zephyr long-sleeve", provenance: "inferred", mark: "inf" });
    expect(name?.how).toBe("read off the picture, not stated");
    expect(line(name!)).not.toContain("stated on the page");
  });

  it("says a field a person corrected came from their team, not from the page", () => {
    const corrected = card({ fit: { value: "Regular", provenance: "observed", corrected: true } });
    const fit = cardFields(corrected).find((field) => field.name === "fit");

    expect(fit).toMatchObject({ value: "Regular", corrected: true, how: "corrected by your team" });
  });

  it("writes the sizes and the fabric weight in words a person reads", () => {
    const fields = cardFields(runningShort());

    expect(fields.find((field) => field.name === "sizeRange")?.value).toBe("S · M · L · XL");
    expect(fields.find((field) => field.name === "gsm")?.value).toBe("140 g/m²");
  });
});

describe("cardFeatures", () => {
  it("carries each feature's purpose and how it is known", () => {
    const features = cardFeatures(runningShort());

    expect(features.map((feature) => feature.key)).toContain("zip_back_pocket");
    expect(features.find((feature) => feature.key === "bonded_hem")).toMatchObject({ provenance: "inferred", mark: PROVENANCE_MARKS.inferred });
    expect(features.every((feature) => feature.purpose !== "" && feature.how !== "")).toBe(true);
  });

  it("leaves out a feature key the taxonomy does not know, rather than showing a bare key", () => {
    const unknown = { ...runningShort(), features: [{ key: "not_a_feature", provenance: "observed" as const, corrected: false }] };

    expect(cardFeatures(unknown)).toEqual([]);
  });
});

describe("the seller's claims and the reviewers' themes", () => {
  it("marks a claim as the seller's own words, never as a fact", () => {
    expect(cardClaims(runningShort())).toEqual(["“Squat-proof”, says the seller"]);
  });

  it("ranks the complaint themes by how often they came up", () => {
    expect(cardThemes(runningShort()).map((theme) => theme.count)).toEqual([31, 19]);
  });

  it("settles a tie by the words, so the order is the same every time", () => {
    const tied = card({ complaintThemes: [{ theme: "B theme", count: 4 }, { theme: "A theme", count: 4 }] });

    expect(cardThemes(tied).map((theme) => theme.theme)).toEqual(["A theme", "B theme"]);
  });
});
