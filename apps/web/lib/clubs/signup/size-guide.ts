import { formatCm } from "@/lib/garment";
import { getType } from "@/lib/garment/registry";
import { gradeChart } from "@/lib/sizing";
import type { ChartSet } from "@/lib/sizing";
import type { WearerGroup } from "../wording";

/**
 * The size guide on the sign-up page (spec F-T4 step 2 "with the size guide on the page", plan v5
 * Z7, decision 0086).
 *
 * The guide is the club's own size chart, graded by the same code the tech pack grades with, so a
 * player reads the numbers the garment will actually be made to. Nothing is invented: a club with
 * no chart for a wearer has no guide, and the page says so rather than showing made-up numbers. A
 * measurement with no value in the chart is left out of the row, never filled in.
 */

/**
 * The wearer the chart is kept under, for each cut a player may choose. Three of the four are the
 * registry's own wearers. **Unisex is a labelled default**: the registry has no unisex wearer, so a
 * unisex kit is shown the men's chart and the guide says so in `WEARER_NOTE`. Owner question in
 * `docs/decisions/0086-committee-link-and-roster-signup.md`.
 */
const CHART_WEARER: Readonly<Record<WearerGroup, string>> = {
  mens: "men",
  womens: "women",
  junior: "youth",
  unisex: "men",
};

/** What a unisex kit's guide says, so nobody reads a men's chart as a unisex one. */
export const WEARER_NOTE = "A unisex kit has no size chart of its own yet, so these are the men's measurements.";

export interface GuideCell {
  readonly pointId: string;
  readonly label: string;
  /** The measurement in centimetres, as the tech pack writes it. */
  readonly value: string;
}

export interface GuideRow {
  readonly sizeLabel: string;
  readonly cells: readonly GuideCell[];
}

export interface SizeGuide {
  readonly sizes: readonly string[];
  readonly points: readonly Readonly<{ pointId: string; label: string; howToMeasure: string }>[];
  readonly rows: readonly GuideRow[];
  /** Says plainly where the numbers came from, so nobody reads a platform chart as the club's own. */
  readonly source: string;
  /** One sentence when there is no guide to show, otherwise null. */
  readonly notice: string | null;
}

const EMPTY: SizeGuide = {
  sizes: [],
  points: [],
  rows: [],
  source: "",
  notice: "Your club has not put its size chart in yet, so there is no guide here. Choose the size you usually wear.",
};

/** The most measurements a guide shows. A player reads three or four, not twelve. */
const POINTS_SHOWN = 4;

/**
 * The guide for one cut, without a design to go by: a sign-up link belongs to a season, not to a
 * design, so there is no garment type to choose a chart with. The club's own chart for that wearer
 * is preferred over a Knitwright starter chart, and the source line says which one it was.
 */
export function guideForWearer(charts: ChartSet, wearerGroup: WearerGroup): SizeGuide {
  const wearer = CHART_WEARER[wearerGroup];
  const forWearer = charts.charts.filter((entry) => entry.wearer === wearer);
  const chart = forWearer.find((entry) => entry.supplier === "brand") ?? forWearer[0];
  return chart ? buildSizeGuide(charts, chart.garmentType, wearerGroup) : EMPTY;
}

/**
 * The guide for one garment type and one cut, or an empty guide with a plain notice. The chart is
 * the one the club's own charts hold for that wearer; a platform chart says so in its source line.
 */
export function buildSizeGuide(charts: ChartSet, garmentType: string, wearerGroup: WearerGroup): SizeGuide {
  const wearer = CHART_WEARER[wearerGroup];
  const chart = charts.charts.find((entry) => entry.garmentType === garmentType && entry.wearer === wearer);
  const run = chart ? charts.runs.find((entry) => entry.id === chart.sizeRunId) : undefined;
  if (!chart || !run) return EMPTY;
  const graded = gradeChart(chart, run);
  if (!graded.ok) return EMPTY;
  const type = getType(garmentType);
  const named = graded.rows.flatMap((row) => {
    const point = type?.pointsOfMeasure.find((entry) => entry.id === row.pointId);
    return point ? [{ row, point }] : [];
  });
  const shown = named.slice(0, POINTS_SHOWN);
  const supplier = chart.supplier === "brand" ? "your club's own size chart" : "a Knitwright starter chart, not your club's own";
  const unisex = wearerGroup === "unisex" ? ` ${WEARER_NOTE}` : "";
  return {
    sizes: run.sizes,
    points: shown.map(({ point }) => ({ pointId: point.id, label: point.label, howToMeasure: point.howToMeasure })),
    rows: run.sizes.map((sizeLabel) => ({
      sizeLabel,
      cells: shown.flatMap(({ row, point }) => {
        const value = row.values.find((entry) => entry.size === sizeLabel);
        return value ? [{ pointId: point.id, label: point.label, value: formatCm(value.value) }] : [];
      }),
    })),
    source: `Measured from ${supplier}, by ${chart.source.person} on ${chart.source.date}. The garment, not your body.${unisex}`,
    notice: shown.length === 0 ? EMPTY.notice : null,
  };
}
