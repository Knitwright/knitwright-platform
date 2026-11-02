import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import type { GarmentSpec } from "@/lib/garment";
import { designObjectFacts, toDesignObjectV2 } from "./to-v2";

/**
 * The design's own facts, and the export format's limits, are two different questions. This file holds the
 * difference: `toDesignObjectV2` answers "can techpack.json hold this design", and `designObjectFacts` answers
 * "what is this design", which is what a caller that writes no techpack.json needs.
 */

const ARTICLE = { baseArticleCode: "JSY-SS-01", productionClass: "B" as const, parameters: { body_length_offset: 10 } };

type Colourway = GarmentSpec["colourways"][number];

const unswatch = (way: Colourway): Colourway => ({
  ...way,
  colours: way.colours.map((entry) => ({ panelId: entry.panelId, colour: entry.colour, provenance: entry.provenance })),
});

/** The same team jersey with no screen colour anywhere: a colour chosen by name, with no swatch picked yet. */
const unswatched = (): GarmentSpec => {
  const spec = jersey();
  const [first, ...rest] = spec.colourways;
  return { ...spec, colourways: [unswatch(first), ...rest.map(unswatch)] };
};

describe("designObjectFacts", () => {
  it("is the same object the export format returns when the format can hold the design", () => {
    const result = toDesignObjectV2(jersey(), { article: ARTICLE, fabricCode: "F-POLY-INT" });
    if (!result.ok) throw new Error(result.reason);
    expect(designObjectFacts(jersey(), { article: ARTICLE, fabricCode: "F-POLY-INT" })).toEqual(result.object);
  });

  it("still says what the design is when the export format refuses it", () => {
    const spec = unswatched();
    const refused = toDesignObjectV2(spec, { article: ARTICLE, fabricCode: "F-POLY-INT" });

    expect(refused).toEqual({ ok: false, reason: "No colour of this design has a screen colour yet, and the export format needs at least one." });

    // The facts are all there: the article, its parameters, the design's own options and its fabric code. Only the
    // colourway is empty, because no colour of this design has a screen colour -- which is a gap to be named, not a
    // reason to refuse to describe the design.
    const facts = designObjectFacts(spec, { article: ARTICLE, fabricCode: "F-POLY-INT" });
    expect(facts.colourway.colours).toEqual([]);
    expect(facts.article.base_article_code).toBe("JSY-SS-01");
    expect(facts.article.parameters).toEqual({ body_length_offset: 10 });
    expect(facts.article.fabric.code).toBe("F-POLY-INT");
    expect(Object.keys(facts.article.options).length).toBeGreaterThan(0);
    expect(facts.panels.length).toBeGreaterThan(0);
  });
});
