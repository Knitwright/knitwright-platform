import { sourceLabel } from "../cell";
import type { Cell, SectionId } from "../types";

/**
 * What each format holds. The PDF holds every section. The Excel file holds one sheet for
 * each section that holds values, and the two that do not (the drawings, and the words that say
 * how to measure) are in the PDF and the SVG files only. The SVG files hold one view each.
 * The names are within Excel's rules: at most 31 characters and none of \ / ? * [ ] :
 */
export const EXCEL_SHEETS: Readonly<Record<SectionId, string | null>> = {
  cover: "Cover",
  readiness: "Ready for the factory",
  flats: null,
  measurements: "Measurements",
  "how-to-measure": null,
  "pattern-and-cutting": "Pattern and cutting",
  components: "Components",
  fabric: "Fabric",
  construction: "Construction",
  colourways: "Colourways",
  artwork: "Artwork",
  "artwork-and-colour": "Artwork and colour",
  operations: "Order of work",
  labelling: "Labels and packing",
  suggested: "Suggested values",
  "sign-off": "Sign-off",
};

/**
 * The source of a cell in words, or null for a cell that is to be confirmed. A proposal says it
 * is a proposal, as the screen does, and never reads as a specification. An option nobody chose
 * is the standard choice.
 */
export function sourceWords(cell: Cell): string | null {
  return cell.status === "set" ? sourceLabel(cell) : null;
}
