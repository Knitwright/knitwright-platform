import { Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY } from "@/lib/flat/pdf-font";
import { TO_BE_CONFIRMED } from "../../cell";
import { sourceWords } from "../contents";
import type { Column, Datum, ExportTable } from "../tables";
import { COLOURS, SIZES } from "./styles";

/** Turns text into text the PDF font can draw. Every string that goes into the PDF passes through it. */
export type Safe = (text: string) => string;

const KEEP_WITH_NEXT = 60;

export const heading = (level: 2 | 3, text: string, safe: Safe): ReactElement =>
  h(
    Text,
    {
      minPresenceAhead: KEEP_WITH_NEXT,
      style: {
        fontFamily: PDF_FONT_FAMILY,
        fontSize: level === 2 ? SIZES.section : SIZES.table,
        color: COLOURS.ink,
        marginTop: level === 2 ? 16 : 10,
        marginBottom: 4,
      },
    },
    safe(text),
  );

export const paragraph = (text: string, safe: Safe, key?: string): ReactElement =>
  h(Text, { key, style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.muted, marginBottom: 3, lineHeight: 1.3 } }, safe(text));

const CELL_STYLE = { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.cell, color: COLOURS.ink } as const;

const valueText = (text: string, safe: Safe, key: string): ReactElement => h(Text, { key, style: CELL_STYLE }, safe(text));

/** A small line inside a cell, in the muted colour, or the attention colour for a proposal. */
const noteSpan = (text: string, safe: Safe, colour: string = COLOURS.muted): ReactElement =>
  h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.small, color: colour } }, safe(text));

/**
 * A value with lines under it, all in one text node. The PDF library lays out each text node on
 * its own, and that is the slowest part of a document, so a value and its source share one.
 */
const withNotes = (value: string, notes: readonly ReactElement[], safe: Safe): ReactElement[] => [
  h(Text, { key: "v", style: CELL_STYLE }, safe(value), ...notes.flatMap((note) => ["\n", note])),
];

/** A value that nobody has filled in says so, in the attention colours. It is never blank, a zero or a dash. */
const missing = (key: string): ReactElement =>
  h(
    Text,
    {
      key,
      style: {
        fontFamily: PDF_FONT_FAMILY,
        fontSize: SIZES.cell,
        color: COLOURS.warn,
        backgroundColor: COLOURS.warnWash,
        paddingHorizontal: 2,
        alignSelf: "flex-start",
      },
    },
    TO_BE_CONFIRMED,
  );

/** What a datum prints, as a value and, under it, the words for where the value came from. */
function contentOf(datum: Datum, safe: Safe): ReactElement[] {
  switch (datum.kind) {
    case "text":
      return [valueText(datum.text, safe, "t")];
    case "value":
      if (datum.cell === null) return [];
      return datum.cell.status === "set"
        ? withNotes(datum.cell.value, [noteSpan(sourceWords(datum.cell) ?? "", safe)], safe)
        : [missing("m")];
    case "length":
      return datum.cell.status === "set"
        ? withNotes(`${datum.cell.value} cm`, [noteSpan(sourceWords(datum.cell) ?? "", safe)], safe)
        : [missing("m")];
    case "number":
      return datum.cell.status === "set"
        ? withNotes(datum.cell.value, [noteSpan(sourceWords(datum.cell) ?? "", safe)], safe)
        : [missing("m")];
    case "class":
      return withNotes(
        `${datum.cell.value}, ISO ${datum.cell.iso}`,
        [noteSpan(sourceWords(datum.cell) ?? "", safe, datum.cell.proposal ? COLOURS.warn : COLOURS.muted), noteSpan(datum.cell.explanation, safe)],
        safe,
      );
  }
}

const KIND_WEIGHT: Readonly<Record<Column["kind"], number>> = { text: 1, value: 1.3, length: 0.85, number: 0.9, class: 1.8 };

/** Each column's share of the width. A text column of short words, such as a code, is narrow. */
function widthsOf(table: ExportTable): string[] {
  const weights = table.columns.map((column, index) => {
    if (column.kind !== "text") return KIND_WEIGHT[column.kind];
    const longest = table.rows.reduce((most, row) => {
      const datum = row[index];
      return Math.max(most, datum?.kind === "text" ? datum.text.length : 0, column.header.length);
    }, 0);
    return Math.min(2, Math.max(0.45, longest / 12));
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => `${((weight / total) * 100).toFixed(3)}%`);
}

const cellBox = (width: string) => ({ width, paddingVertical: 3, paddingHorizontal: 3 });

/**
 * A table of the document. The header row is fixed, so it is drawn again at the top of every page
 * the table runs onto. A row is never split across two pages.
 */
export function dataTable(table: ExportTable, safe: Safe): ReactElement {
  const widths = widthsOf(table);
  const header = h(
    View,
    { key: "header", fixed: true, style: { flexDirection: "row", backgroundColor: COLOURS.head } },
    ...table.columns.map((column, index) =>
      h(View, { key: `h${index}`, style: cellBox(widths[index] ?? "10%") }, valueText(column.header, safe, "h")),
    ),
  );
  const rows = table.rows.map((row, rowIndex) =>
    h(
      View,
      { key: `r${rowIndex}`, wrap: false, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOURS.line } },
      ...row.map((datum, index) => h(View, { key: `c${index}`, style: cellBox(widths[index] ?? "10%") }, ...contentOf(datum, safe))),
    ),
  );
  return h(View, { style: { marginBottom: 6 } }, header, ...rows);
}
