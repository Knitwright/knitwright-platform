import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, fullDesign, packFor } from "../fixtures/designs";
import { SECTION_IDS, type SectionId } from "../types";
import { sheetNameProblem } from "./excel/cells";
import { PAGE_IDS, CLOSING_PAGE_IDS } from "./pages";
import { exportSections } from "./tables";
import { TAB_IDS, TAB_OF_PAGE, TECH_PACK_TABS, tabPlan, type TabId } from "./tabs";

/**
 * The eleven tabs of the tech pack view, which are the eleven sheets of the Excel file (F-S6).
 * Its acceptance asks that the Excel file and the PDF hold the same values for one version, so
 * both are built from the same tables and this test checks nothing is dropped on the way.
 */

const full = tabPlan(exportSections(packFor(fullDesign("crew-tee"), { charts: CHARTS })));

const tab = (id: TabId) => {
  const found = full.find((entry) => entry.id === id);
  if (!found) throw new Error(`No tab ${id}`);
  return found;
};

describe("the eleven tabs", () => {
  it("is the eleven tabs of the tech pack view, in its order", () => {
    expect(TECH_PACK_TABS.map((entry) => entry.id)).toEqual([...TAB_IDS]);
    expect(TECH_PACK_TABS.length).toBe(11);
  });

  it("gives every tab a sheet name Excel accepts, and no two the same", () => {
    const names = TECH_PACK_TABS.map((entry) => entry.sheet);
    for (const name of names) expect(sheetNameProblem(name), name).toBeNull();
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every page of the PDF a tab, or says plainly that it has none", () => {
    expect(Object.keys(TAB_OF_PAGE).sort()).toEqual([...PAGE_IDS, ...CLOSING_PAGE_IDS].sort());
    const withoutSheet = Object.entries(TAB_OF_PAGE).flatMap(([page, found]) => (found === null ? [page] : []));
    expect(withoutSheet).toEqual(["technical-flats", "colour-views", "reference-images", "sources-and-notes"]);
  });
});

describe("what each sheet holds", () => {
  it("writes all eleven sheets for a design with everything, and for one with nothing", () => {
    expect(full.map((entry) => entry.sheet)).toEqual(TECH_PACK_TABS.map((entry) => entry.sheet));
    expect(tabPlan(exportSections(packFor(start("crew-tee")))).map((entry) => entry.sheet)).toEqual(full.map((entry) => entry.sheet));
  });

  it("puts every section of the document on exactly one sheet, with all of its tables", () => {
    const sections = exportSections(packFor(fullDesign("crew-tee"), { charts: CHARTS }));
    const placed = full.flatMap((entry) => entry.blocks.map((block) => block.sectionId));
    const onSheets: readonly SectionId[] = SECTION_IDS.filter((id) => placed.includes(id));
    expect(onSheets).toEqual([...SECTION_IDS]);
    for (const id of SECTION_IDS) {
      expect(placed.filter((found) => found === id).length, id).toBe(1);
      const block = full.flatMap((entry) => entry.blocks).find((entry) => entry.sectionId === id);
      const section = sections.find((entry) => entry.id === id);
      expect(block?.tables.length, id).toBe((section?.tables.length ?? 0) + (section?.notes?.length ?? 0));
    }
  });

  it("reads the measurement table before how it is measured, as the tech pack view does", () => {
    expect(tab("measurements").blocks.map((block) => block.sectionId)).toEqual(["measurements", "how-to-measure"]);
  });

  it("puts the fabrics and the other parts on one Materials sheet", () => {
    expect(tab("materials").blocks.map((block) => block.sectionId)).toEqual(["components", "fabric"]);
    expect(tab("materials").blocks.flatMap((block) => block.tables).map((table) => table.title)).toContain("Rib, thread, labels and trims");
  });

  it("puts what nobody has confirmed, and the sign-off, on the Review sheet", () => {
    expect(tab("review").blocks.map((block) => block.sectionId)).toEqual(["suggested", "sign-off"]);
  });

  it("writes the body size chart sheet with the sentence saying it is not in this document yet", () => {
    expect(tab("body").blocks).toEqual([]);
    expect(tab("body").lead).toContain("not in this document yet");
  });

  it("carries the notes that explain single values onto the sheet of their section", () => {
    const pack = packFor(fullDesign("polo"));
    const sections = exportSections(pack);
    const notes = sections.find((entry) => entry.id === "measurements")?.notes ?? [];
    expect(notes.length).toBeGreaterThan(0);
    const measurements = tabPlan(sections).find((entry) => entry.id === "measurements");
    const titles = measurements?.blocks.flatMap((block) => block.tables).map((table) => table.title) ?? [];
    for (const note of notes) expect(titles).toContain(note.title);
  });
});
