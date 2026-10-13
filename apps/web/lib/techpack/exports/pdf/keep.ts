import type { Datum, ExportSection, ExportTable } from "../tables";
import { TO_BE_CONFIRMED } from "../../cell";
import { CONTENT_WIDTH } from "./styles";

/**
 * Which tables and sections are kept whole on one page. A node that cannot be split and is taller than
 * a page is cut off by the PDF library, so something is kept whole only when an estimate of its height,
 * in points, puts it well under a page. Anything larger is allowed to run onto the next page, and a
 * table then repeats its header row. The estimate counts lines of text from the number of characters and
 * the width of the column, and is on the high side on purpose.
 */

/** A table is kept whole when it is estimated at no more than this. */
export const KEPT_TABLE_POINTS = 480;
/** A section is kept whole when it is estimated at no more than this. */
export const KEPT_SECTION_POINTS = 560;

/** Average width of a character at the sizes used, in points. It is on the wide side, so lines are counted high. */
const CELL_CHARACTER = 4.6;
const BODY_CHARACTER = 5;

const CELL_LINE = 10;
const BODY_LINE = 12;
const CELL_PADDING = 6;
const HEADING_TWO = 38;
const HEADING_THREE = 26;

const linesOf = (characters: number, width: number, character: number): number =>
  Math.max(1, Math.ceil((characters * character) / Math.max(20, width)));

/** The characters a mark such as " [1]" adds after a value, on the same line. */
const MARK_CHARACTERS = 4;

/** How tall a datum is in a column of this width, in points. A missing value may wrap onto two lines. */
function datumHeight(datum: Datum, width: number): number {
  const main = (characters: number) => linesOf(characters, width, CELL_CHARACTER) * CELL_LINE;
  const missing = main(TO_BE_CONFIRMED.length);
  switch (datum.kind) {
    case "text":
      return main(datum.text.length);
    case "value":
      if (datum.cell === null) return 0;
      return datum.cell.status === "set" ? main(datum.cell.value.length + MARK_CHARACTERS) : missing;
    case "length":
    case "number":
      return datum.cell.status === "set" ? main(datum.cell.value.length + 3 + MARK_CHARACTERS) : missing;
    case "class":
      return main(datum.cell.value.length + 10 + MARK_CHARACTERS);
  }
}

/** An estimate of how tall a table is, with its heading and sentence, in points. */
export function tableHeight(table: ExportTable): number {
  const width = CONTENT_WIDTH / Math.max(1, table.columns.length) - 2 * 3;
  const heading = (table.title === null ? 0 : HEADING_THREE) + (table.intro === null ? 0 : linesOf(table.intro.length, CONTENT_WIDTH, BODY_CHARACTER) * BODY_LINE + 3);
  if (table.rows.length === 0) return heading;
  const header = CELL_PADDING + Math.max(...table.columns.map((column) => linesOf(column.header.length, width, CELL_CHARACTER))) * CELL_LINE;
  const rows = table.rows.reduce(
    (sum, row) => sum + CELL_PADDING + row.reduce((tallest, datum) => Math.max(tallest, datumHeight(datum, width)), CELL_LINE),
    0,
  );
  return heading + header + rows;
}

export const keepsTableWhole = (table: ExportTable): boolean => tableHeight(table) <= KEPT_TABLE_POINTS;

/** An estimate of how tall a whole section is, in points. */
export function sectionHeight(section: ExportSection): number {
  const sentences = section.paragraphs.reduce((sum, text) => sum + linesOf(text.length, CONTENT_WIDTH, BODY_CHARACTER) * BODY_LINE + 3, 0);
  return HEADING_TWO + sentences + section.tables.reduce((sum, table) => sum + tableHeight(table), 0);
}

/** Sections with drawings are never kept whole: the height of a drawing is not estimated. Each drawing is kept whole instead. */
const HAS_DRAWINGS: ReadonlySet<string> = new Set(["flats", "colourways"]);

export const keepsSectionWhole = (section: ExportSection): boolean =>
  !HAS_DRAWINGS.has(section.id) && sectionHeight(section) <= KEPT_SECTION_POINTS;
