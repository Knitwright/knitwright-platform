import { View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { ClassCell } from "../../types";
import { table, text, textColumn, type ExportSection, type ExportTable } from "../table-types";
import { markLabel, type SourceMarks } from "./marks";
import { heading, paragraph, type Safe } from "./parts";
import { tableGroup } from "./sections";

/** The title of the appendix at the end of the specification. */
export const SOURCES_AND_NOTES = "Sources and notes";
const KEY_INTRO = "The number in square brackets after a value says where that value came from.";
const KEY_TITLE = "Where each value came from";
const CLASSES_TITLE = "Seam and stitch classes";

/** The key of the marks: each mark the document uses, with the words of its source. */
const keyTable = (marks: SourceMarks): ExportTable =>
  table(
    KEY_TITLE,
    [textColumn("Mark"), textColumn("Source")],
    [...marks].map(([words, mark]) => [text(markLabel(mark)), text(words)]),
  );

/** Each seam or stitch class the document names, once, with what it is. Null when it names none. */
function classesTable(sections: readonly ExportSection[]): ExportTable | null {
  const classes = new Map<string, ClassCell>();
  for (const datum of sections.flatMap((section) => section.tables).flatMap((entry) => entry.rows.flat())) {
    if (datum.kind === "class") classes.set(`${datum.cell.value}|${datum.cell.iso}`, datum.cell);
  }
  if (classes.size === 0) return null;
  return table(
    CLASSES_TITLE,
    [textColumn("Class"), textColumn("ISO number"), textColumn("What it is")],
    [...classes.values()].map((cell) => [text(cell.value), text(`ISO ${cell.iso}`), text(cell.explanation)]),
  );
}

/**
 * The appendix at the end of the specification: the key of the marks printed after the values,
 * the seam and stitch classes explained once, then the notes that explain single values, such as
 * why a measurement is missing for a size. The tables before it carry the values and a short mark
 * each, and so read clean for a factory.
 */
export function appendixElement(sections: readonly ExportSection[], marks: SourceMarks, safe: Safe): ReactElement {
  const classes = classesTable(sections);
  const tables = [keyTable(marks), ...(classes ? [classes] : []), ...sections.flatMap((section) => section.notes ?? [])];
  return h(
    View,
    { key: "appendix" },
    h(View, { key: "lead", wrap: false }, heading(2, SOURCES_AND_NOTES, safe), paragraph(KEY_INTRO, safe, "intro")),
    ...tables.map((entry, index) => tableGroup(entry, index, safe, marks)),
  );
}
