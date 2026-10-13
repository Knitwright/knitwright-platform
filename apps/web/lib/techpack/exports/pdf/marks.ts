import { PROVENANCE_LABELS } from "@/lib/garment";
import { STANDARD_CHOICE } from "../../cell";
import { PROPOSAL_WORDS } from "../../text";
import { sourceWords } from "../contents";
import type { Datum, ExportSection } from "../tables";

/**
 * The PDF prints a short mark after each value, such as [1], instead of the words for its source
 * under every value. The words of each mark are listed once, in the key of the "Sources and notes"
 * appendix, so every value can still be traced to its source (invariant I5) and the tables read
 * clean. The Excel file keeps the words in a column beside each value.
 */

/** The order sources are numbered in, so a document with the same sources always uses the same marks. */
const ORDER: readonly string[] = [
  PROVENANCE_LABELS["user-edited"],
  PROVENANCE_LABELS["brand-supplied"],
  PROVENANCE_LABELS["suggested-chart"],
  PROVENANCE_LABELS["ai-suggested"],
  PROVENANCE_LABELS["read-from-image"],
  PROVENANCE_LABELS.derived,
  STANDARD_CHOICE,
  PROPOSAL_WORDS,
];

/** The mark of each source the document uses: from its words to its number, in the order of the key. */
export type SourceMarks = ReadonlyMap<string, string>;

/** The words for where a datum came from, or null for text and for a value that is to be confirmed. */
function wordsOf(datum: Datum): string | null {
  if (datum.kind === "text") return null;
  if (datum.kind === "value") return datum.cell === null ? null : sourceWords(datum.cell);
  return sourceWords(datum.cell);
}

/** Every source the sections use, numbered from one, in a fixed order. */
export function sourceMarks(sections: readonly ExportSection[]): SourceMarks {
  const used = new Set(
    sections
      .flatMap((section) => [...section.tables, ...(section.notes ?? [])])
      .flatMap((table) => table.rows.flat())
      .flatMap((datum) => {
        const words = wordsOf(datum);
        return words === null ? [] : [words];
      }),
  );
  const ordered = [...ORDER.filter((words) => used.has(words)), ...[...used].filter((words) => !ORDER.includes(words))];
  return new Map(ordered.map((words, index) => [words, String(index + 1)]));
}

/** How a mark is printed. */
export const markLabel = (mark: string): string => `[${mark}]`;
