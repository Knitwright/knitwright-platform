import { PROVENANCE_LABELS } from "@/lib/garment";
import {
  PROPOSAL_WORDS,
  TO_BE_CONFIRMED,
  sourceLabel,
  type Cell,
  type ClassCell,
  type CompletenessReport,
  type LengthValue,
  type SectionId,
} from "@/lib/techpack";
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
    source: sourceLabel(cell),
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

/** A class the platform proposes says so, in the attention style. It never reads as a specification. */
export function classView(cell: ClassCell): ClassView {
  return {
    text: cell.value,
    iso: `ISO ${cell.iso}`,
    explanation: cell.explanation,
    source: cell.proposal ? PROPOSAL_WORDS : PROVENANCE_LABELS[cell.provenance],
    tone: cell.proposal ? "suggested" : toneOf(cell.provenance),
  };
}

/**
 * The style of the notice at the top of the page. It is the attention style while anything is
 * empty, suggested or proposed. The green style is kept for values signed by a named person,
 * which nothing on this page is, so this never gives it.
 */
export const summaryTone = (report: Pick<CompletenessReport, "total" | "suggested" | "proposed">): "warn" | "info" =>
  report.total + report.suggested + report.proposed > 0 ? "warn" : "info";

/** The address of a section on the tech pack page. */
export const sectionLink = (id: SectionId): string => `#${id}`;

const SECTIONS_WITH_FORMS: readonly SectionId[] = ["components", "construction", "labelling"];

/** True when the section keeps a form closed until it is asked for. A link to it opens the form. */
export const sectionHasForms = (id: SectionId): boolean => SECTIONS_WITH_FORMS.includes(id);
