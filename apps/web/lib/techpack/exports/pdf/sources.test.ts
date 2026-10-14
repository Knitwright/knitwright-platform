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
import { markOf, noSpace, readPdfOf, sourceOf, withMark } from "../fixtures/pdf-helpers";

describe("every value is printed with its source (T5, invariant I5)", () => {
  it("holds for every set cell of a full design: a mark next to the value, and the mark's words in the key at the end", async () => {
    const pack = packFor(fullDesign("polo"), { charts: CHARTS });
    const { pages, warnings } = await readPdfOf(pack);
    const text = noSpace(allText(pages));
    const cells = allCells(pack).filter(({ cell }) => cell.status === "set");
    expect(cells.length).toBeGreaterThan(80);
    for (const { path, cell } of cells) expect(text, path).toContain(withMark(text, cell));
    expect(warnings).toEqual([]);
  });

  it("gives each source one mark, numbered from one, and lists only the sources the document uses", async () => {
    const pack = packFor(fullDesign("polo"), { charts: CHARTS });
    const text = noSpace(allText((await readPdfOf(pack)).pages));
    const used = [...new Set(allCells(pack).filter(({ cell }) => cell.status === "set").map(({ cell }) => sourceOf(cell)))];
    const marks = used.map((words) => markOf(text, words));
    expect(new Set(marks).size).toBe(used.length);
    expect([...marks].map(Number).sort((a, b) => a - b)).toEqual(used.map((_, index) => index + 1));
    expect(markOf(text, "Read from a picture")).toBeUndefined();
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
    const proposal = markOf(squashed, PROPOSAL_WORDS);
    expect(proposal).toBeDefined();
    for (const seam of pack.construction.seams) {
      expect(squashed, seam.label).toContain(noSpace(`${seam.stitchClass.value}, ISO ${seam.stitchClass.iso}[${proposal}]`));
    }
  });

  // One PDF for each test, as in formats.test.ts. A PDF takes about 1.7 s to make since the v2 sections
  // (about 1.0 s before), and CI runs slower than a laptop, so two PDFs in one test came close to the
  // five-second limit. Four seeds of one run each cover the same number of random designs.
  it.each([1, 2, 3, 4])("holds for documents built from designs made by random changes, run %i", async (seed) => {
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
          expect(text, path).toContain(cell.status === "set" ? withMark(text, cell) : noSpace(TO_BE_CONFIRMED));
        }
        expect(warnings).toEqual([]);
      }),
      { numRuns: 1, seed },
    );
  });
});
