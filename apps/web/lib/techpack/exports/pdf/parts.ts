import { Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { SetCell } from "../../cell";
import { sourceWords } from "../contents";
import { ExportRefused } from "../errors";
import type { Column, Datum, ExportTable } from "../tables";
import { markLabel, type SourceMarks } from "./marks";
import { COLOURS, SIZES } from "./styles";
import type { Safe } from "./typeset";

/**
 * The pieces every page is built from. Each one is given the document's typeset (`typeset.ts`), which
 * makes its text drawable and says which font it is in and which way it reads, so one page set serves
 * the English document and the Urdu one (decision 0104).
 */
export type { Safe };

/** A heading keeps this much of what follows it on its page, so it is never left alone above a table that moves on. */
const KEEP_WITH_NEXT = 100;

export const heading = (level: 2 | 3, text: string, safe: Safe): ReactElement =>
  h(
    Text,
    {
      minPresenceAhead: KEEP_WITH_NEXT,
      style: {
        fontFamily: safe.family,
        direction: safe.direction,
        fontSize: level === 2 ? SIZES.section : SIZES.table,
        color: COLOURS.ink,
        marginTop: level === 2 ? 16 : 10,
        marginBottom: 4,
      },
    },
    safe(text),
  );

export const paragraph = (text: string, safe: Safe, key?: string): ReactElement =>
  h(
    Text,
    {
      key,
      style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.body, color: COLOURS.muted, marginBottom: 3, lineHeight: 1.3 },
    },
    safe(text),
  );

const cellStyle = (safe: Safe) => ({ fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.cell, color: COLOURS.ink }) as const;

const valueText = (text: string, safe: Safe, key: string): ReactElement => h(Text, { key, style: cellStyle(safe) }, safe(text));

/** The mark of a source, printed small after a value: in the attention colour for a proposal. */
function markSpan(cell: SetCell, marks: SourceMarks, safe: Safe): ReactElement {
  const words = sourceWords(cell) as string;
  const mark = marks.get(words);
  if (mark === undefined) throw new ExportRefused(`The source "${words}" has no mark in the key.`);
  const proposal = "proposal" in cell && cell.proposal === true;
  return h(
    Text,
    { style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.small, color: proposal ? COLOURS.warn : COLOURS.muted } },
    ` ${markLabel(mark)}`,
  );
}

/**
 * A value with the mark of its source after it, in one text node. The PDF library lays out each
 * text node on its own, and that is the slowest part of a document.
 */
const withMark = (value: string, cell: SetCell, marks: SourceMarks, safe: Safe): ReactElement[] => [
  h(Text, { key: "v", style: cellStyle(safe) }, safe(value), markSpan(cell, marks, safe)),
];

/**
 * A value that nobody has filled in says so, in the attention colours and in the document's own
 * language. It is never blank, a zero or a dash. In the narrow columns of numbers it is in smaller
 * type, so it stays on one line.
 */
const missing = (key: string, safe: Safe, fontSize: number = SIZES.cell): ReactElement =>
  h(
    Text,
    {
      key,
      style: {
        fontFamily: safe.family,
        direction: safe.direction,
        fontSize,
        color: COLOURS.warn,
        backgroundColor: COLOURS.warnWash,
        paddingHorizontal: 2,
        alignSelf: "flex-start",
      },
    },
    safe.words("value.to-be-confirmed"),
  );

/** What a datum prints: a value with the mark of its source after it, or the words for a missing value. */
function contentOf(datum: Datum, safe: Safe, marks: SourceMarks): ReactElement[] {
  switch (datum.kind) {
    case "text":
      return [valueText(datum.text, safe, "t")];
    case "value":
      if (datum.cell === null) return [];
      return datum.cell.status === "set" ? withMark(datum.cell.value, datum.cell, marks, safe) : [missing("m", safe)];
    case "length":
      return datum.cell.status === "set" ? withMark(`${datum.cell.value} cm`, datum.cell, marks, safe) : [missing("m", safe, SIZES.small)];
    case "number":
      return datum.cell.status === "set" ? withMark(datum.cell.value, datum.cell, marks, safe) : [missing("m", safe, SIZES.small)];
    case "class":
      // The explanation of the class is said once, in the appendix, not under every seam.
      return withMark(`${datum.cell.value}, ISO ${datum.cell.iso}`, datum.cell, marks, safe);
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
 * the table runs onto. A row is never split across two pages. In a right-to-left document the cells
 * of every row run the other way, so the first column is the rightmost one.
 */
export function dataTable(table: ExportTable, safe: Safe, marks: SourceMarks): ReactElement {
  const widths = widthsOf(table);
  const header = h(
    View,
    { key: "header", fixed: true, style: { flexDirection: safe.row, backgroundColor: COLOURS.head } },
    ...table.columns.map((column, index) =>
      h(View, { key: `h${index}`, style: cellBox(widths[index] ?? "10%") }, valueText(column.header, safe, "h")),
    ),
  );
  const rows = table.rows.map((row, rowIndex) =>
    h(
      View,
      { key: `r${rowIndex}`, wrap: false, style: { flexDirection: safe.row, borderBottomWidth: 0.5, borderBottomColor: COLOURS.line } },
      ...row.map((datum, index) => h(View, { key: `c${index}`, style: cellBox(widths[index] ?? "10%") }, ...contentOf(datum, safe, marks))),
    ),
  );
  return h(View, { style: { marginBottom: 6 } }, header, ...rows);
}
