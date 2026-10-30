import type { ArticlePom } from "@/lib/catalogue";
import type { KppPom } from "../model";

/**
 * The points of measure, from X1's `article_poms` (decision 0066). Every value is the row's own; nothing is
 * interpolated, rounded or filled in.
 *
 * **Owner decision 18 stands.** A POM with no tolerance is not given one here. `article_poms` keeps a tolerance on
 * every row, so one read from the catalogue always has both halves — but a POM reaching the builder from anywhere
 * else may not, which is why this takes the wider shape, and the F-G2 gate then refuses the package and names the
 * POM. The catalogue's own tolerances are the build pack's draft figures, seeded under the article's
 * "not reviewed by a factory" label; they are carried through with that label, never presented as agreed, and the
 * spec's +/-10/5/3 mm paragraph is not adopted as a default for anything the rows do not state.
 */

/**
 * A point of measure as the builder reads it: X1's row, and the same row from any other source where the grade or
 * the tolerance may be missing. `ArticlePom` is assignable to this.
 */
export type PomRow = Readonly<
  Omit<ArticlePom, "gradeMm" | "tolMinusMm" | "tolPlusMm" | "valuesMm"> & {
    gradeMm: number | null;
    tolMinusMm: number | null;
    tolPlusMm: number | null;
    valuesMm: Readonly<Record<string, number | null>>;
  }
>;

/** One POM over one size run. A size the row has no value for stays null, so the gate names it. */
const toPom = (row: PomRow, sizes: readonly string[]): KppPom => ({
  letter: row.letter,
  code: row.code,
  description: row.description,
  gradeType: row.gradeType,
  gradeMm: row.gradeMm,
  tolMinusMm: row.tolMinusMm,
  tolPlusMm: row.tolPlusMm,
  values: Object.fromEntries(sizes.map((size) => [size, row.valuesMm[size] ?? null])),
  ruleId: row.ruleId,
  // The catalogue is the base article's own data, not the brand's choice, and no factory has confirmed it.
  provenance: "from_base",
});

/** Every POM of the article over the sizes the package covers, in the article's own order. */
export const measurements = (poms: readonly PomRow[], sizes: readonly string[]): readonly KppPom[] => poms.map((row) => toPom(row, sizes));
