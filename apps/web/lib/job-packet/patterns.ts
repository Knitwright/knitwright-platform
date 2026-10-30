import type { Batch, OpsOrder } from "@/lib/ops/rows";

/**
 * The pattern files of a batch, for the factory's ZIP. `drafted-patterns.ts` fills this seam from the
 * production package's own writers (X5, decision 0070) over the graded drafter (X3, decision 0068);
 * `noPatterns` stays as the source that adds nothing, which the tests of both sides use.
 *
 * A source always says, in words, what the `patterns/` folder holds or why it is empty. It never guesses
 * at a pattern: an article nothing has drafted gives no file and a sentence saying so.
 */

export interface PatternFile {
  /** A path inside the ZIP's patterns folder, such as `dxf_aama/JSY-SS-01_M.dxf`. */
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface PatternSet {
  readonly files: readonly PatternFile[];
  /** The sentence the README carries about `patterns/`, or null to keep the README's own standing line. */
  readonly note: string | null;
}

export interface PatternSource {
  filesFor(batch: Batch, orders: readonly OpsOrder[]): Promise<PatternSet>;
}

export const NO_PATTERNS_NOTE =
  "Patterns are not in this ZIP yet. Knitwright sends the pattern files for this batch separately until the production package is connected.";

/** The source that adds nothing and says so. Kept for the tests of both sides of the seam. */
export const noPatterns: PatternSource & Readonly<{ note: string }> = {
  note: NO_PATTERNS_NOTE,
  filesFor: async () => ({ files: [], note: NO_PATTERNS_NOTE }),
};
