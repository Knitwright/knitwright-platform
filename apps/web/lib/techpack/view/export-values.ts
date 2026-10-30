import type { TechPackView } from "./model";
import { cellsOf } from "./rows";
import { TAB_LABELS, type TechPackTabId } from "./tabs";

/**
 * The values a tech pack export carries, read once from the view model.
 *
 * Spec F-S6's acceptance test is that "the Excel and PDF exports contain identical values for the
 * same version". The only way to be sure of that is for both to read one list, so this file is that
 * list: every value of every exported tab, in one order, each with where it sits. Y5 owns the two
 * formats (`lib/techpack/exports/**`); what it must not do is work a value out a second time.
 *
 * The Excel is one sheet per tab (spec F-S6). The PDF is the 16 pages of spec F-S6. The two
 * groupings put the same values in different places and drop none, which `export-values.test.ts`
 * proves by comparing them value by value.
 *
 * The **Review** tab is not exported: it is the editor's own list of what is still missing, not part
 * of the document a factory reads, and spec F-S6's export section picker does not offer it.
 */

export type ExportValue = Readonly<{
  tabId: TechPackTabId;
  /** The sheet the Excel writes it to, which is the tab's own name. */
  sheet: string;
  /** Which table or field list of the tab it came from. */
  group: string;
  row: string;
  column: string;
  /** The value as the view reads it, or null for a field nobody has filled in. */
  value: string | null;
}>;

/** The tabs an export carries, in reading order. */
export const EXPORTED_TABS: readonly TechPackTabId[] = [
  "overview",
  "body",
  "measurements",
  "materials",
  "callouts",
  "artworks",
  "colourways",
  "personalisation",
  "labels",
  "qc",
];

/**
 * The 16 pages of spec F-S6, and which tab's values each one carries. Pages 2, 3 and 16 are
 * drawings and photographs and carry no value of the view model, so they are listed with no tab
 * rather than left out: a page with nothing on it is still a page of the document.
 *
 * Spec F-S6's page list has no page for the body size chart although its own export section picker
 * offers "Body size chart", so the body chart is carried on page 1 with the overview. That is a
 * reading of the spec, not a fact in it, and it is written down in decision 0077 with the question.
 */
export const PDF_PAGES: readonly Readonly<{ page: number; title: string; tabs: readonly TechPackTabId[] }>[] = [
  { page: 1, title: "Overview", tabs: ["overview", "body"] },
  { page: 2, title: "Technical flats, black and white", tabs: [] },
  { page: 3, title: "Rendered colour views", tabs: [] },
  { page: 4, title: "Bill of materials", tabs: ["materials"] },
  { page: 5, title: "Bill of materials, continued", tabs: [] },
  { page: 6, title: "Construction details", tabs: ["callouts"] },
  { page: 7, title: "Construction annotations", tabs: [] },
  { page: 8, title: "Measurement annotation", tabs: ["measurements"] },
  { page: 9, title: "Size grading", tabs: [] },
  { page: 10, title: "Graphics and prints", tabs: ["artworks"] },
  { page: 11, title: "Print placement", tabs: [] },
  { page: 12, title: "Personalisation", tabs: ["personalisation"] },
  { page: 13, title: "Labels and packaging", tabs: ["labels"] },
  { page: 14, title: "Colourways", tabs: ["colourways"] },
  { page: 15, title: "QC checklist", tabs: ["qc"] },
  { page: 16, title: "Reference images", tabs: [] },
];

/** Every value of every exported tab, in reading order. */
export function exportValues(view: TechPackView): readonly ExportValue[] {
  const out: ExportValue[] = [];
  for (const tabId of EXPORTED_TABS) {
    const found = view.tabs.find((entry) => entry.id === tabId);
    if (!found) continue;
    for (const part of found.sections) {
      for (const field of part.fields) {
        out.push({ tabId, sheet: TAB_LABELS[tabId], group: part.title, row: field.label, column: "Value", value: field.text });
      }
      for (const entry of part.tables) {
        for (const row of entry.rows) {
          row.cells.forEach((item, index) => {
            out.push({ tabId, sheet: TAB_LABELS[tabId], group: entry.title, row: row.label, column: entry.columns[index] ?? item.label, value: item.text });
          });
        }
      }
    }
  }
  return out;
}

export type ExcelSheet = Readonly<{ name: string; tabId: TechPackTabId; values: readonly ExportValue[] }>;

/** The Excel: one sheet per tab (spec F-S6). A tab with no value still gets its sheet. */
export const excelSheets = (view: TechPackView): readonly ExcelSheet[] => {
  const all = exportValues(view);
  return EXPORTED_TABS.map((tabId) => ({ name: TAB_LABELS[tabId], tabId, values: all.filter((entry) => entry.tabId === tabId) }));
};

export type PdfPage = Readonly<{ page: number; title: string; values: readonly ExportValue[] }>;

/** The PDF: the 16 pages of spec F-S6, each carrying the values of the tabs it shows. */
export const pdfPages = (view: TechPackView): readonly PdfPage[] => {
  const all = exportValues(view);
  return PDF_PAGES.map((page) => ({
    page: page.page,
    title: page.title,
    values: all.filter((entry) => page.tabs.includes(entry.tabId)),
  }));
};

/** One value as the text a comparison reads, so two groupings can be checked value by value. */
export const valueKey = (entry: ExportValue): string => `${entry.tabId}|${entry.group}|${entry.row}|${entry.column}|${entry.value ?? ""}`;

/** Every value of the view, however it is grouped, as one sorted list. */
export const flatten = (groups: readonly Readonly<{ values: readonly ExportValue[] }>[]): readonly string[] =>
  groups.flatMap((group) => group.values.map(valueKey)).sort();

/** How many cells the view holds in all, including the Review tab, for a count in a test. */
export const cellCount = (view: TechPackView): number => view.tabs.reduce((total, entry) => total + cellsOf(entry).length, 0);
