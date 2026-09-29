import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { action, typeIds } from "@/lib/garment/fixtures/arbitraries";
import { start } from "@/lib/garment/fixtures/specs";
import { TO_BE_CONFIRMED } from "../../cell";
import { CHARTS, fullDesign, packFor } from "../../fixtures/designs";
import { PROPOSAL_WORDS } from "../../text";
import { allCells } from "../../walk";
import { allText } from "../fixtures/pdf-pages";
import { noSpace, printed, readPdfOf, sourceOf } from "../fixtures/pdf-helpers";
import { drawable } from "../pdf-text";

describe("every value is printed with its source, in words (T5, invariant I5)", () => {
  it("holds for every set cell of a full design, in the text next to it", async () => {
    const pack = packFor(fullDesign("polo"), { charts: CHARTS });
    const { pages, warnings } = await readPdfOf(pack);
    const text = noSpace(allText(pages));
    const cells = allCells(pack).filter(({ cell }) => cell.status === "set");
    expect(cells.length).toBeGreaterThan(80);
    for (const { path, cell } of cells) {
      expect(text, path).toContain(noSpace(`${drawable(printed(cell))}${sourceOf(cell)}`));
    }
    expect(warnings).toEqual([]);
  });

  it("prints to be confirmed as those words for every missing cell, never as a blank, a zero or a dash, and the caveat words for every proposal", async () => {
    const pack = packFor(start("crew-tee"));
    const { pages } = await readPdfOf(pack);
    const text = allText(pages);
    const missing = allCells(pack).filter(({ cell }) => cell.status !== "set").length;
    expect(missing).toBeGreaterThan(10);
    expect(text.split(TO_BE_CONFIRMED).length - 1).toBeGreaterThanOrEqual(missing);

    const squashed = noSpace(text);
    expect(pack.suggested.proposals.length).toBeGreaterThan(0);
    expect(squashed).toContain(noSpace(PROPOSAL_WORDS));
    for (const seam of pack.construction.seams) {
      expect(squashed, seam.label).toContain(noSpace(`${seam.stitchClass.value}, ISO ${seam.stitchClass.iso}${PROPOSAL_WORDS}`));
    }
  });

  it.each([1, 2])("holds for documents built from designs made by random changes, run %i", async (seed) => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...typeIds.slice(0, -1)), fc.array(action, { maxLength: 25 }), fc.boolean(), async (typeId, actions, withCharts) => {
        let spec: GarmentSpec = start(typeId);
        for (const next of actions) {
          const result = applyAction(spec, next);
          if (result.ok) spec = result.spec;
        }
        const pack = packFor(spec, withCharts ? { charts: CHARTS } : {});
        const { pages, warnings } = await readPdfOf(pack);
        const text = noSpace(allText(pages));
        for (const { path, cell } of allCells(pack)) {
          const needle = cell.status === "set" ? `${drawable(printed(cell))}${sourceOf(cell)}` : TO_BE_CONFIRMED;
          expect(text, path).toContain(noSpace(needle));
        }
        expect(warnings).toEqual([]);
      }),
      { numRuns: 2, seed },
    );
  });
});
