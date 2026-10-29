import type { Batch, OpsOrder } from "@/lib/ops/rows";

/**
 * The pattern files of a batch, for the factory's ZIP. This is the seam the production package assembler (X5)
 * fills in a later wave with graded DXF, 1:1 PDF and SVG per size. Until then no patterns are added and the
 * README in the ZIP says so, rather than guessing at a pattern.
 */

export interface PatternFile {
  /** A path inside the ZIP's patterns folder, such as `ORDER-1/dxf_aama/M.dxf`. */
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface PatternSource {
  /** A sentence for the README when the source adds nothing, or null when it does. */
  readonly note: string | null;
  filesFor(batch: Batch, orders: readonly OpsOrder[]): Promise<readonly PatternFile[]>;
}

export const NO_PATTERNS_NOTE =
  "Patterns are not in this ZIP yet. Knitwright sends the pattern files for this batch separately until the production package is connected.";

/** The source in use until the production package assembler is wired in. */
export const noPatterns: PatternSource = {
  note: NO_PATTERNS_NOTE,
  filesFor: async () => [],
};
