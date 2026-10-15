import { beforeAll, describe, expect, it } from "vitest";
import { packFor } from "../../fixtures/designs";
import { completeProduction } from "../../fixtures/production";
import { ASSETS, PICTURE_ACCEPTED, PICTURE_STACK, withStack } from "../../fixtures/stacks";
import { allText, type ReadPage } from "../fixtures/pdf-pages";
import { noSpace, readPdfOf } from "../fixtures/pdf-helpers";

/** The PDF of a design read from a picture carries the layers, the repeat spec, the report and its limits, and the same bytes twice. */
describe("the PDF of a design with an artwork stack", () => {
  const pack = packFor(withStack(PICTURE_STACK), { production: { ...completeProduction(), assets: ASSETS, picture: PICTURE_ACCEPTED } });
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

  it("prints the layers, the resolution of the pictures, the report and its limits, and who accepted the reading", () => {
    const text = noSpace(allText(pages));
    for (const sentence of [
      "Layers, bottom to top",
      "Pictures and their resolution",
      "Read from a picture",
      "This is a close reading of your picture",
      "Logos are redrawn, not extracted",
      "Mia Chen on 12 Oct 2026",
    ]) {
      expect(text, sentence).toContain(noSpace(sentence));
    }
    expect(text).not.toMatch(/exactly|identical/i);
  });
});
