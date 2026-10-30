import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, fullDesign, packFor } from "../fixtures/designs";
import { SECTION_IDS, type SectionId } from "../types";
import {
  CLOSING_PAGES,
  PAGE_GAPS,
  PAGE_IDS,
  SECTION_PAGE,
  TECH_PACK_PAGES,
  pageGapRuleIds,
  pagePlan,
  type AnyPageId,
  type PlannedPage,
} from "./pages";
import { exportSections } from "./tables";
import { RULE_ID_PATTERN } from "@/lib/validation/rules";

/**
 * The sixteen pages of `docs/spec/02-features.md` F-S6 (plan v5 Y5, decision 0078). The
 * specification numbers and names them, and this is where the platform says which part of the
 * document each one holds.
 */

const full = pagePlan(exportSections(packFor(fullDesign("crew-tee"), { charts: CHARTS })));
const empty = pagePlan(exportSections(packFor(start("crew-tee"))));

const page = (plan: readonly PlannedPage[], id: AnyPageId): PlannedPage => {
  const found = plan.find((entry) => entry.id === id);
  if (!found) throw new Error(`No page ${id}`);
  return found;
};

const sectionsOn = (plan: readonly PlannedPage[], id: AnyPageId): readonly SectionId[] =>
  page(plan, id).blocks.map((block) => block.sectionId);

describe("the sixteen pages the specification asks for", () => {
  it("is sixteen pages, numbered one to sixteen in the specification's order", () => {
    expect(TECH_PACK_PAGES.length).toBe(16);
    expect(TECH_PACK_PAGES.map((entry) => entry.number)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
    expect(TECH_PACK_PAGES.map((entry) => entry.id)).toEqual([...PAGE_IDS]);
  });

  it("names them as the specification names them, in its own order", () => {
    expect(TECH_PACK_PAGES.map((entry) => entry.title)).toEqual([
      "Overview",
      "Technical flats",
      "Rendered colour views",
      "Bill of materials: fabrics",
      "Bill of materials: rib, thread, trims and labels",
      "Construction details",
      "Construction annotations",
      "Measurement annotation",
      "Size grading",
      "Graphics and prints",
      "Print placement",
      "Personalisation",
      "Labels and packaging",
      "Colourways",
      "QC checklist",
      "Reference images",
    ]);
  });

  it("gives every page a sentence saying what it is for, and no page an empty title", () => {
    for (const entry of [...TECH_PACK_PAGES, ...CLOSING_PAGES]) {
      expect(entry.title.length, entry.id).toBeGreaterThan(2);
      expect(entry.lead.endsWith("."), entry.id).toBe(true);
    }
  });

  it("draws the flats twice, once with no colour and once in colour, and names a drawing on four pages", () => {
    const drawn = TECH_PACK_PAGES.flatMap((entry) => (entry.drawing === null ? [] : [[entry.id, entry.drawing] as const]));
    expect(drawn).toEqual([
      ["technical-flats", "flats-mono"],
      ["colour-views", "flats-colour"],
      ["construction-annotations", "flats-callouts"],
      ["colourways", "colourway-fronts"],
      ["reference-images", "illustrations"],
    ]);
  });
});

describe("what each page of the plan holds", () => {
  it("plans the sixteen pages and then the pages after them", () => {
    expect(full.map((entry) => entry.number)).toEqual([...Array.from({ length: 16 }, (_, index) => index + 1), null, null]);
    expect(full.slice(16).map((entry) => entry.id)).toEqual(CLOSING_PAGES.map((entry) => entry.id));
  });

  it("puts every section of the document on exactly one page, and loses no table", () => {
    const sections = exportSections(packFor(fullDesign("crew-tee"), { charts: CHARTS }));
    const planned = full.flatMap((entry) => entry.blocks);
    for (const id of SECTION_IDS) {
      const blocks = planned.filter((block) => block.sectionId === id);
      expect(blocks.length, id).toBeGreaterThan(0);
      const section = sections.find((entry) => entry.id === id);
      expect(blocks.flatMap((block) => block.tables).length, id).toBe(section?.tables.length);
    }
  });

  it("keeps a section's heading and sentences on the page its section belongs to, and nowhere else", () => {
    const withLead = full.flatMap((entry) => entry.blocks.filter((block) => block.paragraphs.length > 0).map((block) => [entry.id, block.sectionId] as const));
    for (const [pageId, sectionId] of withLead) expect(SECTION_PAGE[sectionId], sectionId).toBe(pageId);
  });

  it("splits the bill of materials over pages four and five, as the specification does", () => {
    expect(page(full, "bom-fabrics").blocks.flatMap((block) => block.tables).map((table) => table.title)).toContain("Fabric");
    expect(page(full, "bom-parts").blocks.flatMap((block) => block.tables).map((table) => table.title)).toEqual([
      "Rib, thread, labels and trims",
    ]);
  });

  it("puts the player names and numbers on the personalisation page, away from the print placements", () => {
    const spec = fullDesign("team-jersey");
    const pack = packFor(
      {
        ...spec,
        namesAndNumbers: {
          places: [{ place: "back-name" }, { place: "back-number", height: 2500 }],
          style: "block",
          colour: "Gold 123C",
          sampleName: "PLAYER",
          sampleNumber: "10",
          technique: "sublimation",
          provenance: "user-edited",
        },
      },
      { charts: CHARTS },
    );
    const plan = pagePlan(exportSections(pack));
    expect(pack.artwork.playerMarks.length).toBeGreaterThan(0);
    expect(page(plan, "personalisation").blocks.flatMap((block) => block.tables).map((table) => table.title)).toEqual([
      "Player names and numbers",
    ]);
    expect(page(plan, "print-placement").blocks.flatMap((block) => block.tables).map((table) => table.title)).not.toContain(
      "Player names and numbers",
    );
  });

  it("puts the cover on page one, the grading on page nine and the labels on page thirteen", () => {
    expect(sectionsOn(full, "overview")).toEqual(["cover"]);
    expect(sectionsOn(full, "size-grading")).toEqual(["measurements"]);
    expect(sectionsOn(full, "labels-packaging")).toEqual(["labelling"]);
  });

  it("keeps what nobody has confirmed, and the sign-off a factory signs, after the sixteen", () => {
    expect(sectionsOn(full, "confirm-and-sign-off")).toEqual(["suggested", "sign-off"]);
    expect(full.slice(0, 16).flatMap((entry) => entry.blocks.map((block) => block.sectionId))).not.toContain("sign-off");
  });

  it("plans the same sixteen pages for a design with nothing filled in", () => {
    expect(empty.map((entry) => entry.id)).toEqual(full.map((entry) => entry.id));
  });

  it("says in plain words what a page cannot be filled with yet, and gives each gap a rule id", () => {
    expect(Object.keys(PAGE_GAPS)).toEqual(["construction-annotations", "reference-images"]);
    for (const gap of Object.values(PAGE_GAPS)) {
      expect(gap.note.endsWith(".")).toBe(true);
      expect(gap.ruleId).toMatch(RULE_ID_PATTERN);
    }
    expect(pageGapRuleIds()).toEqual(["R-GAP-000"]);
    expect(page(full, "construction-annotations").gap?.ruleId).toBe("R-GAP-000");
    expect(page(full, "overview").gap).toBeNull();
  });
});
