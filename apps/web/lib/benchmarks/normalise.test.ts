import { describe, expect, it } from "vitest";
import { cardFrom, functionalFeatures, withoutCopies } from "./normalise";
import { runningShort } from "./fixtures/cards";

/** The parser, not the model, decides what a card may say (plan rule). */

const full = {
  productName: { value: "Speedshort 5in", provenance: "observed" },
  brandName: { value: "Acme", provenance: "observed" },
  price: { value: { minor: 4500, currency: "gbp" }, provenance: "observed" },
  gsm: { value: 140, provenance: "observed" },
  fabricComposition: { value: "88% polyester, 12% elastane", provenance: "observed" },
  fit: { value: "Slim", provenance: "observed" },
  sizeRange: { value: ["S", "M", "L"], provenance: "observed" },
  features: [
    { key: "zip_back_pocket", provenance: "observed" },
    { key: "bonded_hem", provenance: "inferred" },
  ],
  claims: [{ value: "Squat-proof", provenance: "observed" }],
  complaintThemes: [{ theme: "The liner rides up", count: 31 }],
  surfaceLayout: [{ zone: "left_chest", kind: "mark", provenance: "inferred" }],
};

describe("a page's card", () => {
  it("keeps what the model said and tidies the currency", () => {
    const card = cardFrom(full, "url");
    expect(card.productName).toEqual({ value: "Speedshort 5in", provenance: "observed", corrected: false });
    expect(card.price.value).toEqual({ minor: 4500, currency: "GBP" });
    expect(card.features).toEqual([
      { key: "zip_back_pocket", provenance: "observed", corrected: false },
      { key: "bonded_hem", provenance: "inferred", corrected: false },
    ]);
    expect(card.surfaceLayout).toEqual([{ zone: "left_chest", kind: "mark", provenance: "inferred" }]);
  });

  it("makes anything it cannot use unknown instead of failing the card", () => {
    const card = cardFrom({ ...full, fit: { value: 7, provenance: "observed" }, gsm: { value: "heavy", provenance: "observed" } }, "url");
    expect(card.fit).toEqual({ value: null, provenance: "unknown", corrected: false });
    expect(card.gsm).toEqual({ value: null, provenance: "unknown", corrected: false });
    expect(card.productName.value).toBe("Speedshort 5in");
  });

  it("gives an empty card when the answer is not a card at all", () => {
    expect(cardFrom("sorry, I cannot help with that", "url").features).toEqual([]);
    expect(cardFrom(null, "url").productName.provenance).toBe("unknown");
    expect(cardFrom(42, "photo").complaintThemes).toEqual([]);
  });

  it("drops a feature, a zone and a kind it does not know, and never lists one twice", () => {
    const card = cardFrom(
      {
        features: [
          { key: "welded_zip", provenance: "observed" },
          { key: "drop_tail", provenance: "observed" },
          { key: "drop_tail", provenance: "inferred" },
          { key: "mesh_venting", provenance: "made-up" },
        ],
        surfaceLayout: [
          { zone: "elbow", kind: "mark", provenance: "inferred" },
          { zone: "sleeve", kind: "hologram", provenance: "inferred" },
        ],
      },
      "url",
    );
    // A feature said twice is kept once, as it was first said.
    expect(card.features).toEqual([{ key: "drop_tail", provenance: "observed", corrected: false }]);
    expect(card.surfaceLayout).toEqual([]);
  });
});

describe("a photo shows nothing in words", () => {
  it("reads everything from a picture as inferred, never as stated", () => {
    const card = cardFrom(full, "photo");
    expect(card.productName.provenance).toBe("inferred");
    expect(card.fit.provenance).toBe("inferred");
    expect(card.features.map((f) => f.provenance)).toEqual(["inferred", "inferred"]);
  });

  it("keeps no measurement and no claim from a picture", () => {
    const card = cardFrom(full, "photo");
    expect(card.price).toEqual({ value: null, provenance: "unknown", corrected: false });
    expect(card.gsm.value).toBeNull();
    expect(card.claims).toEqual([]);
  });
});

describe("a measurement is never inferred", () => {
  it("drops a price or a GSM the model only guessed at", () => {
    const card = cardFrom({ ...full, price: { value: { minor: 4500, currency: "GBP" }, provenance: "inferred" }, gsm: { value: 140, provenance: "inferred" } }, "url");
    expect(card.price.value).toBeNull();
    expect(card.gsm.value).toBeNull();
  });
});

describe("a complaint theme is a paraphrase", () => {
  const review = "the liner rides up every single time I go for a run and the pocket bounces about";

  it("drops a theme that copies the words it came from", () => {
    const card = cardFrom(
      { complaintThemes: [{ theme: "the liner rides up every single time I go for a run", count: 4 }, { theme: "The liner rides up", count: 9 }] },
      "review_text",
      review,
    );
    expect(card.complaintThemes).toEqual([{ theme: "The liner rides up", count: 9 }]);
  });

  it("ranks the themes it keeps by how often they came up", () => {
    const card = cardFrom(
      { complaintThemes: [{ theme: "Pocket bounces", count: 19 }, { theme: "Waistband rolls" }, { theme: "Liner rides up", count: 31 }] },
      "url",
    );
    expect(card.complaintThemes).toEqual([
      { theme: "Liner rides up", count: 31 },
      { theme: "Pocket bounces", count: 19 },
      { theme: "Waistband rolls", count: 1 },
    ]);
  });

  it("checks a card that did not come through the parser too", () => {
    const copied = { ...runningShort(), complaintThemes: [{ theme: "the liner rides up every single time I go for a run", count: 3 }] };
    expect(withoutCopies(copied, review).complaintThemes).toEqual([]);
    expect(withoutCopies(copied, "").complaintThemes).toHaveLength(1);
  });
});

describe("the features that may cross over", () => {
  it("is the functional ones, and never a logo, a name or a print", () => {
    expect(functionalFeatures(runningShort()).map((f) => f.key)).toEqual(["zip_back_pocket", "bonded_hem", "liner", "drawcord"]);
  });
});
