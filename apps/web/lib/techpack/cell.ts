import { PROVENANCE_LABELS, type Provenance } from "@/lib/garment";
import { PROPOSAL_WORDS } from "./text";

/** What a factory reads where a value has not been filled in. */
export const TO_BE_CONFIRMED = "To be confirmed";

/** A value with the place it came from. The two cannot be separated. */
export interface SetCell {
  readonly status: "set";
  /** The value as text, ready to print. */
  readonly value: string;
  readonly provenance: Provenance;
}

/** A value nobody has filled in. It holds no number, no text and no guess. */
export interface TbcCell {
  readonly status: "to-be-confirmed";
}

/**
 * The one type for a value a factory reads. Every such field in a tech pack is a cell,
 * so a value cannot be held without saying where it came from, and a missing value cannot
 * be told apart from a value only by looking for a zero.
 */
export type Cell = SetCell | TbcCell;

/** A cell that holds a length. It keeps the stored number too, so an export can write a number. */
export interface LengthCell extends SetCell {
  /** Whole tenths of a millimetre. */
  readonly tenthsMm: number;
}

export type LengthValue = LengthCell | TbcCell;

/** A kind of stitch or seam, named by its ISO number, with a plain explanation. */
export interface ClassCell extends SetCell {
  /** The ISO 4915 stitch type or ISO 4916 seam class number. It names a kind and is not a quantity. */
  readonly iso: string;
  readonly explanation: string;
  /** True when the platform proposed this and nobody has chosen or confirmed it. */
  readonly proposal: boolean;
}

/** Says a thing is only proposed by the platform. It is a value, so it carries its source too. */
export interface ProposalCell extends SetCell {
  readonly proposal: true;
}

/** A cell that holds a number that is not a length: a weight or a turn. It keeps the number and its unit in words. */
export interface NumberCell extends SetCell {
  readonly number: number;
  /** The unit in words, such as "grams per square metre". */
  readonly unit: string;
}

export type NumberValue = NumberCell | TbcCell;

export const TBC: TbcCell = Object.freeze({ status: "to-be-confirmed" });

/** A cell for text a person may or may not have filled in. Empty text is to be confirmed. */
export const textCell = (text: string, provenance: Provenance): Cell =>
  text.trim() === "" ? TBC : { status: "set", value: text.trim(), provenance };

export const isSet = (cell: Cell): cell is SetCell => cell.status === "set";

/** A cell for a number a person entered. Null is to be confirmed. `shortUnit` is what is printed after the number. */
export const numberCell = (
  number: number | null,
  unit: string,
  shortUnit: string,
  provenance: Provenance,
): NumberValue => (number === null ? TBC : { status: "set", value: `${number} ${shortUnit}`, provenance, number, unit });

/** The source of an option that nobody chose: the garment type starts with it. */
export const STANDARD_CHOICE = "Standard choice";

/**
 * An option choice that nobody made. The design stores it as `derived`, because nobody chose it,
 * but it is the garment type's standard choice, not a value worked out from other values.
 */
interface StandardCell extends SetCell {
  readonly standard: true;
}

/** The cell for the choice of an option. A choice nobody made says it is the standard choice. */
export function choiceCell(label: string, provenance: Provenance): Cell {
  if (provenance !== "derived" || label.trim() === "") return textCell(label, provenance);
  const standard: StandardCell = { status: "set", value: label.trim(), provenance, standard: true };
  return standard;
}

/**
 * Where a set value came from, in words. A proposal says it is a proposal and never reads as a
 * specification. A standard choice says so. Every other value names its source.
 */
export function sourceLabel(cell: SetCell): string {
  if ("proposal" in cell && cell.proposal === true) return PROPOSAL_WORDS;
  if ("standard" in cell && cell.standard === true) return STANDARD_CHOICE;
  return PROVENANCE_LABELS[cell.provenance];
}
