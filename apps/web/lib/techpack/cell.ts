import type { Provenance } from "@/lib/garment";

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
}

export const TBC: TbcCell = Object.freeze({ status: "to-be-confirmed" });

/** A cell for text a person may or may not have filled in. Empty text is to be confirmed. */
export const textCell = (text: string, provenance: Provenance): Cell =>
  text.trim() === "" ? TBC : { status: "set", value: text.trim(), provenance };

export const isSet = (cell: Cell): cell is SetCell => cell.status === "set";
