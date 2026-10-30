import type { Cell, ClassCell, LengthValue, NumberValue, SectionId } from "../types";
import type { AnyPageId } from "./pages";

/**
 * What every format is made from: plain tables, in reading order. A datum is a piece of text,
 * or a cell of the document. A cell keeps its source, so no format can print a value without it.
 */
export type Datum =
  | { readonly kind: "text"; readonly text: string }
  /** A text value with its source, or null for a place that holds nothing (not even to be confirmed). */
  | { readonly kind: "value"; readonly cell: Cell | null }
  | { readonly kind: "length"; readonly cell: LengthValue }
  | { readonly kind: "number"; readonly cell: NumberValue }
  | { readonly kind: "class"; readonly cell: ClassCell };

export type DatumKind = Datum["kind"];

export interface Column {
  readonly header: string;
  readonly kind: DatumKind;
  /** For a length: the unit in the header, "cm" unless said otherwise. For a number: the unit in words. */
  readonly unit?: string;
}

export interface ExportTable {
  /** A heading above the table, or null. */
  readonly title: string | null;
  /** One plain sentence under the heading, or null. */
  readonly intro: string | null;
  readonly columns: readonly Column[];
  /** No rows means the table is only its heading and sentence. */
  readonly rows: readonly (readonly Datum[])[];
  /**
   * The page of the PDF this table belongs to, when it is not the page of its section
   * (`SECTION_PAGE`). A section whose tables go to different pages of the sixteen names them here.
   */
  readonly page?: AnyPageId;
}

export interface ExportSection {
  readonly id: SectionId;
  readonly title: string;
  /** The name of the Excel sheet, or null when the Excel file has none for this section. */
  readonly sheet: string | null;
  /** Sentences before the tables. */
  readonly paragraphs: readonly string[];
  readonly tables: readonly ExportTable[];
  /**
   * Notes that explain single values, kept out of the way of the tables. The PDF prints them in its
   * "Sources and notes" appendix and the Excel file under the section's tables. Absent means none.
   */
  readonly notes?: readonly ExportTable[];
}

export const text = (value: string): Datum => ({ kind: "text", text: value });
export const value = (cell: Cell | null): Datum => ({ kind: "value", cell });
export const length = (cell: LengthValue): Datum => ({ kind: "length", cell });
export const number = (cell: NumberValue): Datum => ({ kind: "number", cell });
export const classed = (cell: ClassCell): Datum => ({ kind: "class", cell });

export const textColumn = (header: string): Column => ({ header, kind: "text" });
export const valueColumn = (header: string): Column => ({ header, kind: "value" });
export const lengthColumn = (header: string, unit = "cm"): Column => ({ header, kind: "length", unit });
export const numberColumn = (header: string, unit: string): Column => ({ header, kind: "number", unit });
export const classColumn = (header: string): Column => ({ header, kind: "class" });

export const table = (
  title: string | null,
  columns: readonly Column[],
  rows: readonly (readonly Datum[])[],
  intro: string | null = null,
  page?: AnyPageId,
): ExportTable => ({ title, intro, columns, rows, ...(page === undefined ? {} : { page }) });

/** The panels a line names, as one line of words. */
export const namesOf = (panels: readonly { readonly label: string }[]): string => panels.map((panel) => panel.label).join(", ");
