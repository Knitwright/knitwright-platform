import type { SectionId, TechPack } from "../types";
import { SECTION_IDS } from "../types";
import { ExportRefused } from "./errors";
import type { ExportSection } from "./table-types";
import { coverSection, flatsSection, howToMeasureSection, measurementsSection } from "./tables-front";
import {
  artworkSection,
  colourwaysSection,
  componentsSection,
  constructionSection,
  labellingSection,
  signOffSection,
  suggestedSection,
} from "./tables-parts";

export type { Column, Datum, ExportSection, ExportTable } from "./table-types";

const BUILDERS: Readonly<Record<SectionId, (pack: TechPack) => ExportSection>> = {
  cover: coverSection,
  flats: flatsSection,
  measurements: measurementsSection,
  "how-to-measure": howToMeasureSection,
  components: componentsSection,
  construction: constructionSection,
  colourways: colourwaysSection,
  artwork: artworkSection,
  labelling: labellingSection,
  suggested: suggestedSection,
  "sign-off": signOffSection,
};

/** A number cell must be in the unit its column names, or the header would state the wrong unit. */
function checkUnits(section: ExportSection): void {
  for (const table of section.tables) {
    table.columns.forEach((column, index) => {
      if (column.kind !== "number") return;
      for (const row of table.rows) {
        const datum = row[index];
        if (datum?.kind === "number" && datum.cell.status === "set" && datum.cell.unit !== column.unit) {
          throw new ExportRefused(`A number in "${column.header}" is in ${datum.cell.unit}, and the column says ${column.unit}.`);
        }
      }
    });
  }
}

/**
 * The document as plain tables, one section after another in the order of the tech pack. The PDF
 * and the Excel file are both made from these, so they cannot disagree about what a section holds.
 */
export function exportSections(pack: TechPack): readonly ExportSection[] {
  const sections = SECTION_IDS.map((id) => BUILDERS[id](pack));
  sections.forEach(checkUnits);
  return sections;
}
