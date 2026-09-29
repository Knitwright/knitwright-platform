import { PROVENANCE_LABELS } from "@/lib/garment";
import { TO_BE_CONFIRMED, type Cell, type ClassCell, type LengthValue, type SectionId } from "@/lib/techpack";
import { toneOf, type Tone } from "./provenance-tone";

/**
 * How a value of the tech pack is shown on the screen. A missing value says "To be confirmed"
 * in the attention style. A value says where it came from in plain words. Nothing here
 * has a style or a word for "checked": nothing in the document is.
 */
export type CellTone = Tone | "missing";

export interface CellView {
  readonly text: string;
  /** Where the value came from, in words, or null when there is no value. */
  readonly source: string | null;
  readonly tone: CellTone;
}

export function cellView(cell: Cell, unit?: string): CellView {
  if (cell.status !== "set") return { text: TO_BE_CONFIRMED, source: null, tone: "missing" };
  return {
    text: unit ? `${cell.value} ${unit}` : cell.value,
    source: PROVENANCE_LABELS[cell.provenance],
    tone: toneOf(cell.provenance),
  };
}

/** A tolerance is a length in centimetres, written with its plus or minus sign already. */
export const toleranceView = (cell: LengthValue): CellView => cellView(cell, "cm");

export interface ClassView extends CellView {
  /** "ISO 514", the number that names the kind of stitch or seam. */
  readonly iso: string;
  readonly explanation: string;
}

export function classView(cell: ClassCell): ClassView {
  return {
    text: cell.value,
    iso: `ISO ${cell.iso}`,
    explanation: cell.explanation,
    source: PROVENANCE_LABELS[cell.provenance],
    tone: toneOf(cell.provenance),
  };
}

/** The address of a section on the tech pack page. */
export const sectionLink = (id: SectionId): string => `#${id}`;
