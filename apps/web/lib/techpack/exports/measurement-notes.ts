import type { MeasureGroup } from "../types";
import { table, text, textColumn, type ExportTable } from "./table-types";

const MEASUREMENT_NOTES = "Measurement notes";
/** Stands for the name of a measurement at the start of a note, while notes of several rows are compared. */
const NAME_SLOT = "\u0000";
const EACH_OF_THESE = "Each of these";

interface NoteGroup {
  readonly template: string;
  readonly first: string;
  readonly codes: readonly string[];
  readonly labels: readonly string[];
}

/** The note with the name of its measurement taken out when it starts with it, so notes of several rows can be compared. */
const templateOf = (note: string, label: string): string => (note.startsWith(`${label} `) ? `${NAME_SLOT}${note.slice(label.length)}` : note);

/** The words of a group: the note as it is for one row, or said once for every row of the group. */
const wordsOf = (group: NoteGroup): string =>
  group.codes.length === 1 ? group.first : group.template.replace(NAME_SLOT, EACH_OF_THESE);

/**
 * The notes on single measurements as one table, by code. A note that several rows share, or that
 * differs between them only in the name of the measurement it starts with, is listed once with all
 * their codes, so the same sentence is not printed again for every measurement. Null when no row
 * has a note.
 */
export function measurementNotes(groups: readonly MeasureGroup[]): ExportTable | null {
  const found = new Map<string, NoteGroup>();
  for (const row of groups.flatMap((group) => group.rows)) {
    for (const note of row.notes) {
      const template = templateOf(note, row.label);
      const known = found.get(template);
      found.set(
        template,
        known
          ? { ...known, codes: [...known.codes, row.code], labels: [...known.labels, row.label] }
          : { template, first: note, codes: [row.code], labels: [row.label] },
      );
    }
  }
  if (found.size === 0) return null;
  const rows = [...found.values()].map((group) => [text(group.codes.join(", ")), text(group.labels.join(", ")), text(wordsOf(group))]);
  return table(MEASUREMENT_NOTES, [textColumn("Code"), textColumn("Measurement"), textColumn("Note")], rows);
}
