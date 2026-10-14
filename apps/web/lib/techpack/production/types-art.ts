import type { Cell, LengthValue, NumberValue } from "../cell";

/** The rows the artwork and colour page adds when a design has an artwork stack (W7a). Plain data like the rest of the document. */

export interface LayerRow {
  readonly id: string;
  readonly name: string;
  /** "Ground colour", "Pattern", "Repeating picture", "Placed picture", "Text" or "Player name or number". */
  readonly kind: string;
  readonly views: string;
  /** The zone or anchor, or the area the layer covers. */
  readonly where: string;
  /** Null when the layer has no clear space of its own. */
  readonly clearSpace: LengthValue | null;
  readonly technique: string;
  /** Where the layer came from, in words. */
  readonly provenance: string;
  readonly detail: string;
}

/** Where a placed layer sits on one size, measured on the pattern through the print files' mapper. */
export interface LayerPlacementRow {
  readonly layerId: string;
  readonly layer: string;
  readonly size: string;
  readonly view: string;
  readonly pieceName: string;
  /** From the high point of shoulder (or the top of the sleeve cap) down to the middle of the layer. */
  readonly down: LengthValue;
  /** From the centre front or back (or the middle of the sleeve) across to the middle of the layer. */
  readonly across: LengthValue;
}

/** The repeat of a pattern or a repeating picture, as words and as a record a machine can read. */
export interface RepeatSpecRow {
  readonly layerId: string;
  readonly layer: string;
  readonly kind: "generator" | "tile";
  readonly name: string;
  readonly repeat: string;
  /** "Seed 7" or "No seed". */
  readonly seed: string;
  /** JSON with sorted keys: the generator, its settings and seed, or the tile and its repeat size. */
  readonly machine: string;
}

export type ImageStatus = "meets" | "below" | "unknown" | "vector";

/** One placed picture with the resolution it prints at. */
export interface ImageRow {
  readonly layerId: string;
  readonly layer: string;
  readonly picture: string;
  readonly pixels: string;
  readonly printedWidth: LengthValue;
  /** Null for a vector, which has no resolution to meet. */
  readonly dpi: NumberValue | null;
  readonly status: ImageStatus;
  /** The named person who accepted a picture below the minimum, with the date, or null. */
  readonly acceptedBy: Cell;
  readonly sentence: string;
}

export interface PictureReadBlock {
  /** The one sentence that says it is a close reading and never an exact copy. */
  readonly closeReading: string;
  readonly summary: string | null;
  readonly pictureNote: string | null;
  readonly confidence: string | null;
  readonly limits: readonly string[];
  readonly items: readonly { readonly label: string; readonly confidence: string; readonly note: string }[];
  readonly emptyViews: readonly string[];
  readonly guessed: readonly string[];
  readonly notes: readonly string[];
  readonly fittedTo: string | null;
  /** Who accepted the reading and when, from the record, or to be confirmed. */
  readonly acceptedBy: Cell;
  /** The layers read from the picture that the acceptance does not cover, by name. */
  readonly notAccepted: readonly string[];
  readonly accepted: boolean;
}
