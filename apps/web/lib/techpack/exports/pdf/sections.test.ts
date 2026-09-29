import { beforeAll, describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, PROJECT, TOPS_IDS, fullDesign, packFor, revisions } from "../../fixtures/designs";
import { SECTION_IDS, SECTION_TITLES, type TechPack } from "../../types";
import { allText, type ReadPage } from "../fixtures/pdf-pages";
import { noSpace, readPdfOf } from "../fixtures/pdf-helpers";

const A4 = { width: 595.28, height: 841.89 };

const full = (typeId: string): TechPack =>
  packFor(fullDesign(typeId), { project: { ...PROJECT, styleNumber: "KW-001" }, charts: CHARTS, history: revisions(3) });

describe("the PDF of a full design", () => {
  const pack = full("crew-tee");
  let bytes: Uint8Array;
  let pages: readonly ReadPage[];
  let warnings: readonly string[];

  beforeAll(async () => {
    ({ bytes, pages, warnings } = await readPdfOf(pack, new Map(), { operations: true }));
  });

  it("starts as a PDF and every page is A4 portrait", () => {
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.widthPoints).toBeCloseTo(A4.width, 1);
      expect(page.heightPoints).toBeCloseTo(A4.height, 1);
    }
  });

  it("makes the file with no warning from the PDF library, so nothing was cut off", () => {
    expect(warnings).toEqual([]);
  });

  it("puts the titles in the order of the tech pack", () => {
    const text = noSpace(allText(pages));
    let from = 0;
    for (const id of SECTION_IDS) {
      const at = text.indexOf(noSpace(SECTION_TITLES[id]), from);
      expect(at, id).toBeGreaterThanOrEqual(from);
      from = at;
    }
  });

  it("has a footer on every page with the design, the version, the date and the page count", () => {
    for (const page of pages) {
      expect(page.text).toContain("Club shirt · KW-001");
      expect(page.text).toContain("Version 1");
      expect(page.text).toContain(pack.printedOn);
      expect(page.text).toContain(`Page ${page.number} of ${pages.length}`);
    }
  });

  it("draws the flats as vector paths, with the callouts as text, and no picture", () => {
    expect(allText(pages)).toContain("A 52.0 cm");
    const operations = pages.flatMap((page) => page.operations);
    expect(operations).toContain("constructPath");
    expect(operations).not.toContain("paintImageXObject");
  });

  it("lists the codes on the drawing", () => {
    const text = noSpace(allText(pages));
    expect(pack.flats.callouts.length).toBeGreaterThan(5);
    for (const callout of pack.flats.callouts) expect(text, callout.label).toContain(noSpace(`${callout.code} ${callout.label}`));
  });

  it("starts the flats on a new page, so a heading is never left alone at the foot of the cover", () => {
    const first = pages.findIndex((page) => page.text.includes("Front"));
    expect(first).toBeGreaterThan(0);
    expect(pages[first]?.text.includes(SECTION_TITLES.flats)).toBe(true);
    expect(pages[first - 1]?.text.includes(SECTION_TITLES.flats)).toBe(false);
  });
});

describe("every section is in the PDF, headed by its title (T1)", () => {
  const variants = (typeId: string): readonly (readonly [string, TechPack])[] => [
    ["empty", packFor(start(typeId), { project: { ...PROJECT, styleNumber: "KW-001" } })],
    ["full, sizes from a chart", full(typeId)],
  ];

  describe.each(TOPS_IDS)("%s", (typeId) => {
    it.each(variants(typeId))("holds all eleven titles: %s", async (label, pack) => {
      const { pages, warnings } = await readPdfOf(pack);
      const text = noSpace(allText(pages));
      for (const id of SECTION_IDS) expect(text, id).toContain(noSpace(SECTION_TITLES[id]));
      expect(warnings).toEqual([]);
      // A design with no measurements says its drawings are not to scale.
      if (label === "empty") expect(allText(pages)).toContain("Not to scale");
    });
  });
});
