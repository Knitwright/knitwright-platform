import { describe, expect, it } from "vitest";
import type { BaseArticle } from "@/lib/catalogue";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import type { DesignObjectV2 } from "@/lib/design-object";
import { designShapeFrom } from "./shape";

/** The design as the design-around check reads it: a silhouette from the base's own rows, and a coarse layout. */

const jersey = (): BaseArticle => {
  const found = catalogue().find((article) => article.code === "JSY-SS-01");
  if (found === undefined) throw new Error("The worked article is missing from the catalogue.");
  return found;
};

const object = (parts: Partial<DesignObjectV2> = {}): DesignObjectV2 =>
  ({
    schema_version: "2.0",
    article: { base_article_code: "JSY-SS-01", class: "A", parameters: {}, options: {}, fabric: { code: "F-POLY-INT", colour: null } },
    colourway: { name: "Home", colours: [] },
    panels: [],
    assets: [],
    name_number: { enabled: false, zones: [] },
    labels: { care: "auto", size: "auto", brand_label_asset_id: null },
    provenance: { ai_assisted: false },
    ...parts,
  }) as DesignObjectV2;

describe("the silhouette", () => {
  it("reads a feature from an option the base article itself offers", () => {
    const collar = jersey().options.find((option) => option.group === "collar");
    const shape = designShapeFrom(object({ ...object(), article: { ...object().article, options: { collar: collar!.code } } }), jersey());

    expect(shape.features.length).toBeGreaterThan(0);
  });

  it("reads a parameter as its feature only once the design has moved it off nothing", () => {
    const article = jersey();
    const at = designShapeFrom(object({ article: { ...object().article, parameters: { back_drop_tail: 30 } } }), article);
    const none = designShapeFrom(object({ article: { ...object().article, parameters: { back_drop_tail: 0 } } }), article);

    expect(at.features).toContain("drop_tail");
    expect(none.features).not.toContain("drop_tail");
  });

  it("ignores a parameter the base article does not declare, so no feature is invented from a key", () => {
    const shape = designShapeFrom(object({ article: { ...object().article, parameters: { inseam: 5 } } }), jersey());

    expect(shape.features).not.toContain("inseam_length");
  });

  it("takes a parameter that is a word or a switch as set when it says something", () => {
    const article = { ...jersey(), parameters: [{ ...jersey().parameters[0]!, key: "inseam" }] };
    const on = designShapeFrom(object({ article: { ...object().article, parameters: { inseam: true } } }), article);
    const off = designShapeFrom(object({ article: { ...object().article, parameters: { inseam: false } } }), article);
    const words = designShapeFrom(object({ article: { ...object().article, parameters: { inseam: " " } } }), article);

    expect(on.features).toContain("inseam_length");
    expect(off.features).not.toContain("inseam_length");
    expect(words.features).not.toContain("inseam_length");
  });

  it("has no silhouette at all when there is no article on file: a code is not a feature", () => {
    const shape = designShapeFrom(object({ article: { ...object().article, parameters: { back_drop_tail: 30 }, options: { collar: "C01" } } }), null);

    expect(shape.features).toEqual([]);
  });

  it("names each feature once, however many options amount to it", () => {
    const shape = designShapeFrom(object({ article: { ...object().article, parameters: { back_drop_tail: 30, body_length_offset: 20 } } }), jersey());

    expect(new Set(shape.features).size).toBe(shape.features.length);
  });
});

describe("the layout", () => {
  it("says that something of a kind sits in a zone, and nothing finer", () => {
    const shape = designShapeFrom(
      object({
        panels: [
          { panel_id: "front", layers: [{ type: "fill", colour_role: "main" }, { type: "artwork", asset_id: "a1", x_mm: 100, y_mm: 200 }] },
          { panel_id: "sleeve-left", layers: [{ type: "gradient", colours: ["#000"] }] },
        ],
      }),
      jersey(),
    );

    expect(shape.layout).toEqual([
      { zone: "front", kind: "block" },
      { zone: "front", kind: "mark" },
      { zone: "sleeve", kind: "gradient" },
    ]);
    expect(JSON.stringify(shape.layout)).not.toContain("100");
  });

  it("counts both sleeves as one zone, and a kind in a zone once", () => {
    const shape = designShapeFrom(
      object({
        panels: [
          { panel_id: "sleeve-left", layers: [{ type: "fill" }] },
          { panel_id: "sleeve-right", layers: [{ type: "fill" }] },
        ],
      }),
      jersey(),
    );

    expect(shape.layout).toEqual([{ zone: "sleeve", kind: "block" }]);
  });

  it("leaves out a panel that is not a zone we compare", () => {
    const shape = designShapeFrom(object({ panels: [{ panel_id: "leg-left", layers: [{ type: "fill" }] }] }), jersey());

    expect(shape.layout).toEqual([]);
  });

  it("reads text as text, so a name zone is compared as a place and never as words", () => {
    const shape = designShapeFrom(object({ panels: [{ panel_id: "back", layers: [{ type: "text", text: "SMITH" }] }] }), jersey());

    expect(shape.layout).toEqual([{ zone: "back", kind: "text" }]);
    expect(JSON.stringify(shape)).not.toContain("SMITH");
  });
});
