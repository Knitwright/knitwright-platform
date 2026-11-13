import type { BaseArticle } from "@/lib/catalogue";
import type { ViewCell } from "../view/fields";
import type { MeasurementsView } from "../view/measurements";
import type { TechPackView } from "../view/model";
import { styleCode, type OverviewHeader } from "../view/overview";
import type { TabSection, TabView } from "../view/rows";
import type { TechPackTabId } from "../view/tabs";
import { UNIT_LABELS } from "../view/units";
import { isQcOnly, QC_FILLS } from "./qc-only";
import { toleranceText } from "./tolerance";

/**
 * THE EIGHT SHEETS of the exported tech pack (spec 09 screen 31, `08` v3.7, references x01–x08):
 * Overview, Colourways, Measurements, Size chart, Callouts, Materials, Artworks and Labels, each
 * under the same header (the brand, the product detail table, the sheet's title and "Open in
 * Knitwright").
 *
 * One model for both the preview and the file: the sheets modal draws these blocks and
 * `workbook.ts` writes the same blocks to the .xlsx, so what a person previews is what downloads.
 * Every value is the tech pack view's (`buildTechPackView`), and nothing is filled in here: an empty
 * value reads "Needs your input", or "Set by Knitwright QC" on a 🔒 row.
 */

export const SHEET_IDS = ["overview", "colourways", "measurements", "size-chart", "callouts", "materials", "artworks", "labels"] as const;
export type SheetId = (typeof SHEET_IDS)[number];

export const SHEET_NAMES: Readonly<Record<SheetId, string>> = {
  overview: "Overview",
  colourways: "Colourways",
  measurements: "Measurements",
  "size-chart": "Size chart",
  callouts: "Callouts",
  materials: "Materials",
  artworks: "Artworks",
  labels: "Labels",
};

export const NEEDS_INPUT = "Needs your input";

export type SheetBlock = Readonly<{
  title: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  /** The column drawn as the sample size, or null. */
  highlight: number | null;
  note: string | null;
}>;

export type Sheet = Readonly<{ id: SheetId; name: string; title: string; blocks: readonly SheetBlock[] }>;

export type SheetsHeader = Readonly<{ rows: readonly (readonly [string, string])[]; openIn: string }>;

export type TechPackSheets = Readonly<{ header: SheetsHeader; sheets: readonly Sheet[] }>;

export type SheetsInput = Readonly<{
  view: TechPackView;
  header: OverviewHeader;
  article: Pick<BaseArticle, "code" | "productionClass" | "sampleSize" | "sizeRange"> | null;
  /** The day the file is made, already written for a person ("13 Nov 2026"). */
  date: string;
  /** The tech pack editor's own address, for "Open in Knitwright". */
  openIn: string;
}>;

const valueOf = (entry: ViewCell, from: TechPackTabId): string => entry.text ?? (isQcOnly(entry, from) ? QC_FILLS : NEEDS_INPUT);

const block = (init: Partial<SheetBlock> & Pick<SheetBlock, "title" | "columns" | "rows">): SheetBlock => ({ highlight: null, note: null, ...init });

/** One section of a view tab as blocks: its fields as a Field | Value table, then each of its tables. */
function sectionBlocks(part: TabSection, from: TechPackTabId): readonly SheetBlock[] {
  const fields =
    part.fields.length === 0 && part.tables.length > 0
      ? []
      : [block({ title: part.title, columns: ["Field", "Value"], rows: part.fields.map((entry) => [entry.label, valueOf(entry, from)]), note: part.note })];
  const tables = part.tables.map((entry, index) =>
    block({
      title: entry.title,
      columns: entry.rowHeader === null ? entry.columns : [entry.rowHeader, ...entry.columns],
      rows: entry.rows.map((row) => [...(entry.rowHeader === null ? [] : [row.label]), ...row.cells.map((cell) => valueOf(cell, from))]),
      note: index === 0 && fields.length === 0 ? part.note : entry.note,
    }),
  );
  return [...fields, ...tables];
}

const tabBlocks = (view: TechPackView, id: TechPackTabId): readonly SheetBlock[] =>
  view.tabs.filter((entry: TabView) => entry.id === id).flatMap((entry) => entry.sections.flatMap((part) => sectionBlocks(part, id)));

function sizeChart(measurements: MeasurementsView): SheetBlock {
  const unit = UNIT_LABELS[measurements.unit].toUpperCase();
  const sample = measurements.columns.findIndex((column) => column.isSample);
  return block({
    title: `Size chart (${unit}) · garment measurements`,
    columns: ["Label", "Point of measure", "Tol ±", ...measurements.columns.map((column) => column.size)],
    rows: measurements.rows.map((row) => [
      row.letter,
      row.description,
      toleranceText(row) ?? NEEDS_INPUT,
      ...row.values.map((value) => value.text ?? (row.isExtra ? "" : NEEDS_INPUT)),
    ]),
    highlight: sample < 0 ? null : sample + 3,
    note: measurements.note,
  });
}

const pointsBlock = (measurements: MeasurementsView): SheetBlock =>
  block({
    title: "Points of measure",
    columns: ["Label", "Point of measure", "Grade type", "Grade"],
    rows: measurements.rows.map((row) => [row.letter, row.description, row.gradeTypeLabel, row.grade ?? "—"]),
    note: measurements.note ?? "The red letters on the front and back views mark where each point is taken.",
  });

const reviewBlock = (view: TechPackView): SheetBlock =>
  block({
    title: "Still to fill",
    columns: ["Tab", "Field"],
    rows: view.review.items.map((item) => [item.tabLabel, item.label]),
    note: view.review.summary,
  });

function headerOf(input: SheetsInput): SheetsHeader {
  const { header, article } = input;
  const or = (text: string | null | undefined) => (text === null || text === undefined || text.trim() === "" ? NEEDS_INPUT : text);
  const seasonCollection = [header.season, header.collection].filter((part): part is string => Boolean(part?.trim())).join(" · ");
  const range = article && article.sizeRange.length > 0 ? `${article.sizeRange[0]} – ${article.sizeRange.at(-1)}` : null;
  return {
    rows: [
      ["Brand", or(header.brand)],
      ["Style name", or(header.styleName)],
      ["Style code", or(styleCode(header))],
      ["Season / collection", or(seasonCollection)],
      ["Base product", article ? `${article.code} (Class ${article.productionClass})` : NEEDS_INPUT],
      ["Sample size", article?.sampleSize ?? QC_FILLS],
      ["Size range", or(range)],
      ["Date", input.date],
    ],
    openIn: input.openIn,
  };
}

const sheet = (id: SheetId, blocks: readonly SheetBlock[]): Sheet => ({ id, name: SHEET_NAMES[id], title: SHEET_NAMES[id], blocks });

/** The eight sheets and their shared header. Every block of every sheet comes from the view. */
export function buildSheets(input: SheetsInput): TechPackSheets {
  const { view } = input;
  return {
    header: headerOf(input),
    sheets: [
      sheet("overview", [...tabBlocks(view, "overview"), reviewBlock(view)]),
      sheet("colourways", tabBlocks(view, "colourways")),
      sheet("measurements", [pointsBlock(view.measurements), ...tabBlocks(view, "qc")]),
      sheet("size-chart", [sizeChart(view.measurements), ...tabBlocks(view, "body")]),
      sheet("callouts", tabBlocks(view, "callouts")),
      sheet("materials", tabBlocks(view, "materials")),
      sheet("artworks", [...tabBlocks(view, "artworks"), ...tabBlocks(view, "personalisation")]),
      sheet("labels", tabBlocks(view, "labels")),
    ],
  };
}

/** The file's name: the style code, else the style name, made safe; `design` when there is neither. */
export function sheetsFileName(header: OverviewHeader): string {
  const base = styleCode(header) ?? header.styleName ?? "";
  const safe = base.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${safe === "" ? "design" : safe}_techpack.xlsx`;
}
