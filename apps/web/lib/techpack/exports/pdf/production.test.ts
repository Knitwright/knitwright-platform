import { beforeAll, describe, expect, it } from "vitest";
import { packFor } from "../../fixtures/designs";
import { completeProduction, targetedJersey } from "../../fixtures/production";
import { SECTION_IDS, SECTION_TITLES } from "../../types";
import { allText, type ReadPage } from "../fixtures/pdf-pages";
import { noSpace, readPdfOf } from "../fixtures/pdf-helpers";

/** The PDF of a jersey with every production record carries the v2 sections, and the same bytes twice. */
describe("the PDF with the production records", () => {
  const pack = packFor(targetedJersey(), { production: completeProduction() });
  let pages: readonly ReadPage[];
  let warnings: readonly string[];
  let first: Uint8Array;
  let second: Uint8Array;

  beforeAll(async () => {
    ({ pages, warnings, bytes: first } = await readPdfOf(pack, new Map(), { operations: true }));
    ({ bytes: second } = await readPdfOf(pack, new Map(), { operations: true }));
  });

  it("makes the file with no warning, and the same file twice", () => {
    expect(warnings).toEqual([]);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("puts every title in order, the v2 sections among them", () => {
    const text = noSpace(allText(pages));
    let from = 0;
    for (const id of SECTION_IDS) {
      const at = text.indexOf(noSpace(SECTION_TITLES[id]), from);
      expect(at, id).toBeGreaterThanOrEqual(from);
      from = at;
    }
  });

  it("prints the sentences a factory reads: the list of what is missing, the review, the cut list and the strike-off", () => {
    const text = noSpace(allText(pages));
    for (const sentence of [
      "Not ready for the factory yet",
      "Reviewed by Ana Reyes on 3 Oct 2026",
      "Cut 1 on the fold",
      "The strike-off was accepted by Sam Lee",
      "Measured on the pattern",
      "Settings the print files were made with",
    ]) {
      expect(text, sentence).toContain(noSpace(sentence));
    }
  });
});
