import type { TechPack } from "../types";
import { SECTION_TITLES } from "../types";
import { EXCEL_SHEETS } from "./contents";
import { measurementNotes } from "./measurement-notes";
import {
  length,
  lengthColumn,
  table,
  text,
  textColumn,
  value,
  valueColumn,
  type ExportSection,
} from "./table-types";

/** The paragraphs of a section: its note, when it has one, then the others. */
export const sentences = (...lines: readonly (string | null)[]): readonly string[] =>
  lines.filter((line): line is string => line !== null && line !== "");

const MEASURE_HELP =
  "Lengths are in centimetres. The tolerance is how far a measurement may be out, in either direction. Each value says where it came from, and notes on single measurements are listed by code under Measurement notes.";
const NO_REVISIONS = "No revisions have been recorded yet.";

export function coverSection(pack: TechPack): ExportSection {
  const { cover } = pack;
  const facts = table(
    null,
    [textColumn("Field"), valueColumn("Value")],
    [
      [text("Style number"), value(cover.styleNumber)],
      [text("Season"), value(cover.season)],
      [text("Brand"), value(cover.brand)],
      [text("Design name"), value(cover.designName)],
      [text("Garment type"), value(cover.garmentType)],
      [text("Made for"), value(cover.wearer)],
      [text("Base size"), value(cover.baseSize)],
      [text("Size run"), value(cover.sizeRun)],
    ],
  );
  const document = table(
    "Document",
    [textColumn("Field"), textColumn("Value")],
    [
      [text("Version"), text(String(cover.version))],
      [text("Date of this version"), text(cover.date)],
      [text("Date of this version (year, month, day)"), text(cover.dateIso)],
      [text("Printed on"), text(pack.printedOn)],
      [text("Printed on (year, month, day)"), text(pack.printedOnIso)],
    ],
  );
  const options = table(
    "Design options",
    [textColumn("Option"), valueColumn("Choice")],
    cover.options.map((option) => [text(option.label), value(option.choice)]),
  );
  const revisions = table(
    "Revision history, newest first",
    [textColumn("Version"), textColumn("Date"), textColumn("Date (year, month, day)"), textColumn("What changed"), textColumn("Made by")],
    cover.revisions.map((revision) => [
      text(String(revision.version)),
      text(revision.date),
      text(revision.dateIso),
      text(revision.note),
      text(revision.by),
    ]),
  );
  return {
    id: "cover",
    title: cover.title,
    sheet: EXCEL_SHEETS.cover,
    paragraphs: sentences(cover.note, cover.revisions.length === 0 ? NO_REVISIONS : null, cover.olderRevisionsNote),
    tables: [facts, document, options, ...(cover.revisions.length === 0 ? [] : [revisions])],
  };
}

export function flatsSection(pack: TechPack): ExportSection {
  const { flats } = pack;
  const codes = table(
    "Codes on the drawing",
    [textColumn("Code"), textColumn("Measurement")],
    flats.callouts.map((callout) => [text(callout.code), text(callout.label)]),
  );
  return {
    id: "flats",
    title: flats.title,
    sheet: EXCEL_SHEETS.flats,
    paragraphs: sentences(flats.note),
    tables: flats.callouts.length > 0 ? [codes] : [],
  };
}

export function measurementsSection(pack: TechPack): ExportSection {
  const { measurements } = pack;
  const columns = [
    textColumn("Code"),
    textColumn("Measurement"),
    lengthColumn("Tolerance", "± cm"),
    ...measurements.columns.map((column) => lengthColumn(column.isBase ? `${column.label} (base size)` : column.label)),
  ];
  const groups = measurements.groups.map((group) =>
    table(
      group.label,
      columns,
      group.rows.map((row) => [text(row.code), text(row.label), length(row.tolerance), ...row.values.map(length)]),
    ),
  );
  const notes = measurementNotes(measurements.groups);
  return {
    id: "measurements",
    title: measurements.title,
    sheet: EXCEL_SHEETS.measurements,
    paragraphs: sentences(measurements.note, MEASURE_HELP),
    tables: groups,
    notes: notes === null ? [] : [notes],
  };
}

export function howToMeasureSection(pack: TechPack): ExportSection {
  const section = pack.howToMeasure;
  return {
    id: "how-to-measure",
    title: SECTION_TITLES["how-to-measure"],
    sheet: EXCEL_SHEETS["how-to-measure"],
    paragraphs: sentences(section.note),
    tables: [
      table(
        null,
        [textColumn("Code"), textColumn("Measurement"), textColumn("How to measure it")],
        section.rows.map((row) => [text(row.code), text(row.label), text(row.howToMeasure)]),
      ),
    ],
  };
}
