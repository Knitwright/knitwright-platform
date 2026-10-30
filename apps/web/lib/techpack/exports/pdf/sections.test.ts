import { beforeAll, describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, PROJECT, TOPS_IDS, fullDesign, packFor, revisions } from "../../fixtures/designs";
import { SECTION_IDS, SECTION_TITLES, type TechPack } from "../../types";
import { allText, type ReadPage } from "../fixtures/pdf-pages";
import { noSpace, readPdfOf } from "../fixtures/pdf-helpers";
import { CLOSING_PAGES, TECH_PACK_PAGES, pagePlan } from "../pages";
import { exportSections } from "../tables";

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

  it("puts the sixteen pages of the specification in its order, then the pages after them (F-S6)", () => {
    const text = noSpace(allText(pages));
    let from = 0;
    for (const page of [...TECH_PACK_PAGES, ...CLOSING_PAGES]) {
      const at = text.indexOf(noSpace(page.title), from);
      expect(at, page.id).toBeGreaterThanOrEqual(from);
      from = at;
    }
  });

  it("starts each of the sixteen on a sheet of its own, so a page of the specification is a page of paper", () => {
    const started = TECH_PACK_PAGES.map((page) => pages.findIndex((sheet) => sheet.text.includes(page.title)));
    expect(started.filter((at) => at < 0)).toEqual([]);
    expect([...started]).toEqual([...started].sort((a, b) => a - b));
    expect(new Set(started).size).toBe(TECH_PACK_PAGES.length);
  });

  it("puts the header block on every sheet: brand, style, style number, season, base size and version", () => {
    for (const page of pages) {
      for (const label of ["Brand", "Style number", "Season", "Base size", "Version"]) {
        expect(page.text, `${label} on sheet ${page.number}`).toContain(label);
      }
      expect(page.text).toContain("KW-001");
    }
  });

  it("names every section of the document within the page the plan gives it", () => {
    const plan = pagePlan(exportSections(pack));
    // A page may run onto more than one sheet of paper, so each page is the sheets from where its
    // title appears up to where the next page's title does.
    const startOf = plan.map((entry) => pages.findIndex((sheet) => sheet.text.includes(entry.title)));
    for (const id of SECTION_IDS) {
      const at = plan.findIndex((entry) => entry.blocks.some((block) => block.sectionId === id));
      const from = startOf[at] ?? 0;
      const to = startOf[at + 1] ?? pages.length;
      const text = pages.slice(from, to).map((sheet) => sheet.text).join(" ");
      expect(text, id).toContain(SECTION_TITLES[id]);
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

  it("draws the flats as vector paths, with the code of each callout as text in its mark, and no picture", () => {
    const flats = pages.find((page) => page.text.includes(SECTION_TITLES.flats));
    const words = new Set(flats?.text.split(/\s+/));
    for (const callout of pack.flats.callouts) expect(words.has(callout.code), callout.code).toBe(true);
    expect(allText(pages)).not.toContain("A 52.0 cm");
    const operations = pages.flatMap((page) => page.operations);
    expect(operations).toContain("constructPath");
    expect(operations).not.toContain("paintImageXObject");
  });

  it("lists the codes on the drawing", () => {
    const text = noSpace(allText(pages));
    expect(pack.flats.callouts.length).toBeGreaterThan(5);
    for (const callout of pack.flats.callouts) expect(text, callout.label).toContain(noSpace(`${callout.code} ${callout.label}`));
  });

  it("draws one front for each colourway, named after it, in the colourways section (owner decision 2026-09-30)", () => {
    const text = noSpace(allText(pages));
    const colourways = text.indexOf(noSpace(SECTION_TITLES.colourways));
    expect(pack.colourways.colourways.map((block) => block.drawing.label)).toEqual(["Home, front", "Away, front"]);
    for (const block of pack.colourways.colourways) {
      expect(text.indexOf(noSpace(block.drawing.label), colourways), block.name).toBeGreaterThan(colourways);
    }
  });

  it("keeps the heading of the flats with the first drawing, so the heading is never left alone at the foot of a page", () => {
    // Other sections come before the flats now, so the page is found by the title, not by the first "Front".
    const title = pages.findIndex((page) => page.text.includes(SECTION_TITLES.flats));
    expect(title).toBeGreaterThan(0);
    expect(pages[title]?.text.includes("Front")).toBe(true);
    expect(pages[title - 1]?.text.includes(SECTION_TITLES.flats)).toBe(false);
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
