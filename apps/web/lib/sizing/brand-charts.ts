import type { ChartSet } from "./chart-set";
import type { SizeChart, SizeRun } from "./schemas";

/** A chart a brand imported, with the size run read from the same file. */
export interface BrandChart {
  readonly run: SizeRun;
  readonly chart: SizeChart;
}

const sameGarment = (a: SizeChart, b: SizeChart): boolean => a.wearer === b.wearer && a.garmentType === b.garmentType;

/**
 * The charts a brand's designs use. A brand's own chart for a wearer and garment type
 * takes the place of every platform chart for that wearer and type, whatever their fit,
 * so a design never mixes the brand's numbers with the platform's. Brand charts come
 * first, so the brand's run is found before any other. Nothing is changed.
 */
export function withBrandCharts(platform: ChartSet, brand: readonly BrandChart[]): ChartSet {
  if (brand.length === 0) return platform;
  const own = brand.map((entry) => entry.chart);
  const kept = platform.charts.filter((chart) => !own.some((mine) => sameGarment(mine, chart)));
  return {
    runs: [...brand.map((entry) => entry.run), ...platform.runs],
    charts: [...own, ...kept],
  };
}
