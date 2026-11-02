import type { ArticlePom } from "@/lib/catalogue";
import { gap, held, type Known } from "./gap";

/**
 * The size chart in the contract (plan v5 O2; X1's article data, decision 0066, and Z9's remaining
 * waves, decision 0090).
 *
 * The chart is the base article's own points of measure: the letter, what is being measured, the
 * figure in every size in millimetres, and the tolerance either side. Those are the measurements
 * this platform actually holds and hands a factory, so they are the ones it can hand a Store.
 *
 * **Seven of the eight base articles publish no measurement at all** (decision 0090): their
 * point-of-measure tables are deliberately empty, because the factory's pattern master has not
 * supplied one and the platform invents no measurement. For those articles this is a gap, not an
 * empty table: a table with no rows reads as "one size", and a shopper would be measuring against
 * nothing.
 *
 * There is no body chart here. The platform holds brands' own imported charts (decision 0015) but
 * nobody has published one for a base article, so the contract says which kind of chart this is and
 * leaves the other kind absent rather than passing a garment figure off as a body figure.
 */

export const CHART_SOURCE = "the base article's points of measure, as the tech pack prints them";

/** One row of the chart: one measured place, across the size run. */
export interface SizeChartPoint {
  readonly letter: string;
  readonly code: string;
  readonly description: string;
  /** Millimetres, by size label, as everywhere else in the platform. */
  readonly valuesMm: Readonly<Record<string, number>>;
  readonly tolMinusMm: number;
  readonly tolPlusMm: number;
  readonly ruleId: string;
}

export type StoreSizeChart = Known<{
  /** The size run, in grading order. */
  sizes: readonly string[];
  /** The size the article was made and measured in, where the article names one. */
  sampleSize: Known<{ size: string }>;
  unit: "mm";
  /** Which kind of chart this is, so nobody reads a garment figure as a body figure. */
  source: typeof CHART_SOURCE;
  points: readonly SizeChartPoint[];
}>;

const NO_POINTS = "any point of measure for this article";
const NO_SAMPLE_SIZE = "the size this article was measured in";

const pointOf = (pom: ArticlePom): SizeChartPoint => ({
  letter: pom.letter,
  code: pom.code,
  description: pom.description,
  valuesMm: { ...pom.valuesMm },
  tolMinusMm: pom.tolMinusMm,
  tolPlusMm: pom.tolPlusMm,
  ruleId: pom.ruleId,
});

export interface SizeChartInput {
  readonly sizes: readonly string[];
  readonly sampleSize: string | null;
  readonly poms: readonly ArticlePom[];
}

/**
 * The chart for one article. A point with no figure in any size is left out rather than sent with an
 * empty row, and an article left with no point at all becomes the gap above.
 */
export function storeSizeChart(input: SizeChartInput): StoreSizeChart {
  const points = input.poms.filter((pom) => Object.keys(pom.valuesMm).length > 0).map(pointOf);
  if (points.length === 0 || input.sizes.length === 0) {
    return gap(
      [NO_POINTS],
      `Knitwright holds no figure for ${NO_POINTS}, so there is no size chart to show. The Store must not offer one it has worked out itself.`,
    );
  }
  return held({
    sizes: [...input.sizes],
    sampleSize:
      input.sampleSize === null
        ? gap([NO_SAMPLE_SIZE], `Knitwright holds no figure for ${NO_SAMPLE_SIZE}, so the chart says which sizes it covers but not which one was measured.`)
        : held({ size: input.sampleSize }),
    unit: "mm",
    source: CHART_SOURCE,
    points,
  });
}
