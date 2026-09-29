import { PROVENANCE_LABELS } from "@/lib/garment";
import { PROPOSAL_WORDS } from "../text";
import type { Cell, SectionId } from "../types";
import { EXPORT_VIEWS } from "./formats";

/**
 * What each format holds. The PDF holds all eleven sections. The Excel file holds one sheet for
 * each section that holds values, and the two that do not (the drawings, and the words that say
 * how to measure) are in the PDF and the SVG files only. The SVG files hold one view each.
 * The names are within Excel's rules: at most 31 characters and none of \ / ? * [ ] :
 */
export const EXCEL_SHEETS: Readonly<Record<SectionId, string | null>> = {
  cover: "Cover",
  flats: null,
  measurements: "Measurements",
  "how-to-measure": null,
  components: "Components",
  construction: "Construction",
  colourways: "Colourways",
  artwork: "Artwork",
  labelling: "Labels and packing",
  suggested: "Suggested values",
  "sign-off": "Sign-off",
};

export const SVG_VIEWS = EXPORT_VIEWS;

/**
 * The source of a cell in words, or null for a cell that is to be confirmed. A proposal says it
 * is a proposal, as the screen does, and never reads as a specification.
 */
export function sourceWords(cell: Cell): string | null {
  if (cell.status !== "set") return null;
  return "proposal" in cell && cell.proposal === true ? PROPOSAL_WORDS : PROVENANCE_LABELS[cell.provenance];
}
