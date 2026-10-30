import { describe, expect, it } from "vitest";
import { EXPORTED_TABS, PDF_PAGES, cellCount, excelSheets, exportValues, flatten, pdfPages, valueKey } from "./export-values";
import { article, bareArticle, emptyDesign, emptyHeader, input, mark } from "./fixtures/views";
import { buildTechPackView, type TechPackView } from "./model";
import { TAB_LABELS } from "./tabs";

/**
 * Spec F-S6's acceptance test: **"The Excel and PDF exports contain identical values for the same
 * version."**
 *
 * The two formats are Y5's (`lib/techpack/exports/**`); what is tested here is the thing that makes
 * the acceptance test possible — that both read one list of values, grouped two different ways. The
 * Excel groups by tab, one sheet each; the PDF groups by the 16 pages of spec F-S6. If a value
 * reached one grouping and not the other, or reached one of them twice, the first test below fails.
 */

const views = (): readonly Readonly<{ name: string; view: TechPackView }>[] => [
  { name: "a design on the worked base article", view: buildTechPackView(input()) },
  { name: "the same design in inches", view: buildTechPackView(input({ unit: "in" })) },
  { name: "a design with marks the Specs toolbar drew", view: buildTechPackView(input({ marks: [mark(), mark({ id: "m2", tool: "callout", note: "Tape it" })] })) },
  { name: "a design on a draft article", view: buildTechPackView(input({ article: bareArticle(), sizes: bareArticle().sizeRange })) },
  { name: "a design off the catalogue with nothing filled in", view: buildTechPackView(input({ article: null, spec: emptyDesign(), header: emptyHeader(), sizes: [] })) },
];

describe("the values the Excel and the PDF carry", () => {
  it("are identical, value for value, for every kind of design", () => {
    for (const { name, view } of views()) {
      expect(flatten(excelSheets(view)), name).toEqual(flatten(pdfPages(view)));
    }
  });

  it("are each carried exactly once by each format, so nothing is doubled or dropped", () => {
    for (const { name, view } of views()) {
      const all = exportValues(view).map(valueKey).sort();
      expect(flatten(excelSheets(view)), name).toEqual(all);
      expect(flatten(pdfPages(view)), name).toEqual(all);
    }
  });

  it("stay identical when the unit toggle moves, and the numbers themselves change with it", () => {
    const mm = buildTechPackView(input({ unit: "mm" }));
    const inches = buildTechPackView(input({ unit: "in" }));
    expect(flatten(excelSheets(inches))).toEqual(flatten(pdfPages(inches)));
    expect(flatten(excelSheets(mm))).not.toEqual(flatten(excelSheets(inches)));
  });
});

describe("the Excel", () => {
  it("has one sheet per exported tab, named as the tab is", () => {
    const sheets = excelSheets(buildTechPackView(input()));
    expect(sheets.map((sheet) => sheet.name)).toEqual(EXPORTED_TABS.map((id) => TAB_LABELS[id]));
  });

  it("leaves the Review tab out, because it is the editor's own list and not part of the document", () => {
    expect(EXPORTED_TABS).not.toContain("review");
    expect(exportValues(buildTechPackView(input())).some((entry) => entry.tabId === "review")).toBe(false);
  });

  it("gives every value the row and the column it sits in", () => {
    for (const entry of exportValues(buildTechPackView(input()))) {
      expect(entry.row.length, entry.sheet).toBeGreaterThan(0);
      expect(entry.column.length, `${entry.sheet} ${entry.row}`).toBeGreaterThan(0);
      expect(entry.group.length, `${entry.sheet} ${entry.row}`).toBeGreaterThan(0);
    }
  });

  it("writes a value nobody has as nothing at all, never as a zero and never as [TBC]", () => {
    const empty = exportValues(buildTechPackView(input())).filter((entry) => entry.value === null);
    expect(empty.length).toBeGreaterThan(0);
    for (const entry of exportValues(buildTechPackView(input()))) {
      expect(entry.value, entry.row).not.toBe("");
      expect(entry.value ?? "", entry.row).not.toContain("[TBC]");
    }
  });
});

describe("the PDF", () => {
  it("has the 16 pages spec F-S6 lists, numbered 1 to 16", () => {
    expect(PDF_PAGES.map((page) => page.page)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
    expect(pdfPages(buildTechPackView(input()))).toHaveLength(16);
  });

  it("carries the overview and the body size chart on page 1, because the spec's page list has no page of its own for the chart", () => {
    const page = pdfPages(buildTechPackView(input()))[0];
    expect(page?.title).toBe("Overview");
    expect(new Set(page?.values.map((entry) => entry.tabId))).toEqual(new Set(["overview", "body"]));
  });

  it("puts every exported tab on exactly one page, so no tab's values are split or lost", () => {
    const seen = PDF_PAGES.flatMap((page) => page.tabs);
    expect([...seen].sort()).toEqual([...EXPORTED_TABS].sort());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("keeps the pages that hold drawings and photographs, which carry no value of the view model", () => {
    const pages = pdfPages(buildTechPackView(input()));
    for (const page of [2, 3, 5, 7, 9, 11, 16]) {
      expect(pages.find((entry) => entry.page === page)?.values, `page ${page}`).toEqual([]);
    }
  });

  it("carries the points of measure on the measurement page", () => {
    const page = pdfPages(buildTechPackView(input())).find((entry) => entry.page === 8);
    expect(page?.values.length).toBe(article().poms.length * 14);
  });
});

describe("the whole view", () => {
  it("exports every cell it holds, because the Review tab holds none of its own", () => {
    const view = buildTechPackView(input());
    expect(cellCount(view)).toBe(exportValues(view).length);
    expect(cellCount(view)).toBeGreaterThan(100);
  });
});
