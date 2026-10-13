import { PROVENANCE_LABELS } from "@/lib/garment";
import {
  PROPOSAL_WORDS,
  TO_BE_CONFIRMED,
  sourceLabel,
  type Cell,
  type ClassCell,
  type CompletenessReport,
  type ConfirmItem,
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

const SECTIONS_WITH_FORMS: readonly SectionId[] = ["cover", "measurements", "components", "construction", "colourways", "labelling"];

/** True when the section keeps a form closed until it is asked for. A link to it opens the form. */
export const sectionHasForms = (id: SectionId): boolean => SECTIONS_WITH_FORMS.includes(id);

/**
 * For each section the confirm list names: in one plain sentence, what is needed and why a
 * factory needs it. The list is guidance, not only a count.
 */
export const SECTION_GUIDANCE: Readonly<Partial<Record<SectionId, string>>> = {
  cover: "Give the style number, the season and the sizes, so the factory can name the order and knows which sizes to make.",
  measurements:
    "Give each measurement for every size and how far it may be out, because the factory checks every sample against these numbers.",
  components:
    "Say what each fabric, thread, label and trim is and how much is used, because the factory has to buy them before it can start.",
  construction: "Give the stitch density of each seam, because it decides how strong the seam is and how it looks.",
  colourways:
    "Give a colour code for each part, because a factory matches colour by its code and never by how a screen shows it.",
  labelling:
    "Say what the labels carry and how each garment is folded and bagged, because care and fibre labels are required by law.",
};

/** Where the confirm list takes the person: the form, and the field in it, or null for the form's first empty field. */
export interface FieldTarget {
  /** The `data-field` of the form, or of the field itself. */
  readonly form: string;
  readonly field: string | null;
}

const COVER_FIELDS: Readonly<Record<string, FieldTarget>> = {
  styleNumber: { form: "cover:details", field: "styleNumber" },
  season: { form: "cover:details", field: "season" },
  designName: { form: "cover:details", field: "name" },
  baseSize: { form: "sizes:base", field: null },
  sizeRun: { form: "sizes:list", field: null },
};

/**
 * The field that fills one item of the confirm list, or null when the tech pack page has no
 * field for it: the brand name is set with the brand, and the garment type and wearer in the
 * editor.
 */
export function fieldFor(item: Pick<ConfirmItem, "sectionId" | "target" | "detail">): FieldTarget | null {
  switch (item.sectionId) {
    case "cover":
      return COVER_FIELDS[item.target] ?? null;
    case "measurements":
      return { form: `measurement:${item.target}`, field: null };
    case "components":
      return { form: item.target.startsWith("fabric:") ? item.target : `component:${item.target}`, field: null };
    case "construction":
      return { form: `seam:${item.target}`, field: "stitchDensity" };
    case "colourways": {
      const [colourwayId = "", panelId = ""] = item.target.split(":");
      const field = item.detail?.startsWith("Colour code") ? `code:${panelId}` : `screen:${panelId}`;
      return { form: `colourway:${colourwayId}`, field };
    }
    case "labelling":
      return { form: `labelling:${item.target}`, field: "text" };
    default:
      return null;
  }
}
