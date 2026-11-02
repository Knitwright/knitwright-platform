import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { designObjectFacts, toDesignObjectV2 } from "@/lib/design-object";
import type { GarmentSpec } from "@/lib/garment";
import { checkPackage } from "../gate";
import { fixtureArticle, fixtureRows, FIXTURE_CONSUMPTION } from "../fixtures/rows";
import { buildKppInput } from "./build";
import { NOTHING_UNSOURCED } from "./model";

/**
 * The F-G2 gate is what refuses a production package, and it says everything that is missing in one answer.
 *
 * R3's review of plan v5 (owner question 3b) found that it was never reached: `lib/kpp/sources/server.ts` wrote
 * the design object through `toDesignObjectV2` first, and that is an export format, which refuses a design whose
 * colourway has no screen colour -- as a design in progress usually does. So a brand asking for a package was told
 * about techpack.json's needs and never about its own care label, and decision 0089's care-label refusal was
 * unreachable. The route now reads `designObjectFacts` and lets the gate speak. This file holds that open.
 */

type Colourway = GarmentSpec["colourways"][number];

const unswatch = (way: Colourway): Colourway => ({
  ...way,
  colours: way.colours.map((entry) => ({ panelId: entry.panelId, colour: entry.colour, provenance: entry.provenance })),
});

/** The same team jersey with no screen colour: colours chosen by name, no swatch picked yet. */
const unswatched = (): GarmentSpec => {
  const spec = jersey();
  const [first, ...rest] = spec.colourways;
  return { ...spec, colourways: [unswatch(first), ...rest.map(unswatch)] };
};

const article = fixtureArticle();
const context = {
  article: { baseArticleCode: article.code, productionClass: article.productionClass, parameters: { body_length_offset: 10 } },
  fabricCode: "F-POLY-INT",
};

describe("a design the export format cannot hold", () => {
  it("is still refused by the gate, which names the care label and the colour together", () => {
    // What used to happen instead: one sentence about an export format, and nothing about the garment.
    expect(toDesignObjectV2(unswatched(), context).ok).toBe(false);

    // What the route passes: the design's own facts, and `NOTHING_UNSOURCED` but for the consumption rows the
    // `bom_consumption` table really holds -- which is exactly `readRows`' own `unsourced`.
    const rows = fixtureRows({
      object: designObjectFacts(unswatched(), context),
      unsourced: { ...NOTHING_UNSOURCED, consumption: FIXTURE_CONSUMPTION },
    });
    const messages = checkPackage(buildKppInput(rows)).map((issue) => issue.message);

    expect(messages).toContain("Care label GB: missing care, origin, size.");
    expect(messages).toContain("Care label AU: missing care, origin, size.");
    expect(messages).toContain("Colour spec: no colour roles.");
  });

  it("carries a rule id on every one of those sentences, so each explains itself", () => {
    const rows = fixtureRows({ object: designObjectFacts(unswatched(), context), unsourced: { ...NOTHING_UNSOURCED, consumption: FIXTURE_CONSUMPTION } });
    expect(checkPackage(buildKppInput(rows)).every((issue) => /^R-[A-Z]+-[0-9]{3}$/.test(issue.ruleId))).toBe(true);
  });
});
