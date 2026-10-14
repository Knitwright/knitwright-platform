/**
 * Australian size labels and which pattern size each is cut from (plan: production outputs, W2).
 *
 * Nothing here is a measurement. A men's or women's label takes the starter chart's value at the
 * same label; a junior label takes the nearest youth column; women's 3XL has no published source in
 * docs/sizing/starter-charts.md, so it has no values at all. The label to pattern size map is a
 * suggestion for the owner to change, and says so everywhere it is shown.
 */
import { sizeLabelMapSchema, type ReadinessItem, type SizeLabelMap } from "@/lib/production/contract";
import { DEFAULT_CHARTS } from "./charts";
import { STARTER_MEN_RUN, STARTER_WOMEN_RUN, STARTER_YOUTH_RUN } from "./charts/starter-runs";
import { gradeChart } from "./grading";
import type { SizeChart, SizeRun } from "./schemas";

export const AU_MEN_RUN: SizeRun = { id: "au-men", wearer: "men", sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] };
export const AU_WOMEN_RUN: SizeRun = { id: "au-women", wearer: "women", sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] };
/** Junior sizes as Australian clubs label them, by the age they are usually bought for. */
export const AU_JUNIOR_RUN: SizeRun = { id: "au-junior", wearer: "youth", sizes: ["6", "8", "10", "12", "14", "16"] };
export const AU_RUNS: readonly SizeRun[] = [AU_MEN_RUN, AU_WOMEN_RUN, AU_JUNIOR_RUN];

/**
 * The youth starter column each junior label takes its values from. The youth sources label YS as
 * about ages 6 to 8, YM 10 to 12 and YL 14 to 16, so 6 and 8 take YS, 10 and 12 take YM, 14 and 16 take
 * YL. The owner is to say whether a club's 8 is really cut like a YS.
 */
export const JUNIOR_STARTER_COLUMN: Readonly<Record<string, string>> = Object.freeze({
  "6": "YS",
  "8": "YS",
  "10": "YM",
  "12": "YM",
  "14": "YL",
  "16": "YL",
});

type Cut = SizeLabelMap["cut"];

/** Men's pattern sizes: the benchmark pattern is EU 48 at AU M, and EU sizes step by two. */
const MEN_PATTERN_SIZES = ["44", "46", "48", "50", "52", "54", "56"] as const;

const mapOf = (label: string, wearer: SizeLabelMap["wearer"], cut: Cut, patternSize: string): SizeLabelMap =>
  Object.freeze(sizeLabelMapSchema.parse({ label, wearer, cut, patternSize, source: "suggested" }));

/**
 * Suggested only. Women's and junior patterns do not exist in the library yet, so their pattern
 * sizes carry their own label until a technician drafts them.
 */
export const DEFAULT_SIZE_LABEL_MAPS: readonly SizeLabelMap[] = Object.freeze([
  ...AU_MEN_RUN.sizes.map((label, i) => mapOf(label, "men", "mens", MEN_PATTERN_SIZES[i] as string)),
  ...AU_WOMEN_RUN.sizes.map((label) => mapOf(label, "women", "womens", `women ${label}`)),
  ...AU_JUNIOR_RUN.sizes.map((label) => mapOf(label, "youth", "junior", `junior ${label}`)),
]);

const CUT_WEARER: Readonly<Record<Cut, SizeChart["wearer"] | null>> = {
  mens: "men",
  womens: "women",
  junior: "youth",
  unisex: null,
};

const RUNS_BY_WEARER = { men: STARTER_MEN_RUN, women: STARTER_WOMEN_RUN, youth: STARTER_YOUTH_RUN } as const;
const LABELS_BY_CUT: Readonly<Record<Exclude<Cut, "unisex">, readonly string[]>> = {
  mens: AU_MEN_RUN.sizes,
  womens: AU_WOMEN_RUN.sizes,
  junior: AU_JUNIOR_RUN.sizes,
};

export type CutOfProduct = Readonly<{
  cut: Exclude<Cut, "unisex">;
  /** The starter chart this cut takes its values from, or null when there is none. */
  chart: SizeChart | null;
  labels: readonly string[];
}>;

const findChart = (typeId: string, wearer: SizeChart["wearer"]): SizeChart | null =>
  DEFAULT_CHARTS.find((c) => c.garmentType === typeId && c.wearer === wearer) ?? null;

/** The men's, women's and junior cuts of one product: three charts under one garment type. */
export function cutsOfProduct(typeId: string): readonly CutOfProduct[] {
  return (["mens", "womens", "junior"] as const).map((cut) => ({
    cut,
    chart: findChart(typeId, CUT_WEARER[cut] as SizeChart["wearer"]),
    labels: LABELS_BY_CUT[cut],
  }));
}

export type LabelValue = Readonly<{
  pointId: string;
  /** Tenths of a millimetre, the garment laid flat. */
  valueTenthsMm: number;
  toleranceTenthsMm: number;
  provenance: "suggested-chart";
}>;

export type LabelValues = Readonly<{
  label: string;
  cut: Cut;
  status: "suggested" | "no-starter-values";
  /** The starter chart column the values were taken from. */
  starterColumn: string | null;
  rows: readonly LabelValue[];
  note: string;
}>;

const none = (label: string, cut: Cut, note: string): LabelValues => ({ label, cut, status: "no-starter-values", starterColumn: null, rows: [], note });

/** Which starter column an Australian label takes its values from, or null when none can be named. */
function starterColumnFor(cut: Cut, label: string): string | null {
  if (cut === "junior") return JUNIOR_STARTER_COLUMN[label] ?? null;
  const wearer = CUT_WEARER[cut];
  if (wearer === null || wearer === "youth") return null;
  return RUNS_BY_WEARER[wearer].sizes.includes(label) ? label : null;
}

/** The starter values for one Australian label, all suggested, or none and the reason why. */
export function starterValuesFor(typeId: string, cut: Cut, label: string): LabelValues {
  const wearer = CUT_WEARER[cut];
  const chart = wearer === null ? null : findChart(typeId, wearer);
  if (chart === null) return none(label, cut, "There is no Knitwright starter chart for this garment and cut. Type the values in or import your own chart.");
  const column = starterColumnFor(cut, label);
  if (column === null) {
    return none(label, cut, `No published source gives a ${cut === "womens" ? "women's " : ""}${label} for this garment, so no values are suggested. Type them in or import your own chart.`);
  }
  const graded = gradeChart(chart, RUNS_BY_WEARER[chart.wearer]);
  if (!graded.ok) return none(label, cut, "The starter chart could not be read.");
  const rows = graded.rows.flatMap((row) => {
    const at = row.values.find((v) => v.size === column);
    return at ? [{ pointId: row.pointId, valueTenthsMm: at.value, toleranceTenthsMm: row.tolerance, provenance: "suggested-chart" as const }] : [];
  });
  const age = cut === "junior" ? ` The nearest youth column by age is ${column}.` : "";
  return { label, cut, status: "suggested", starterColumn: column, rows, note: `Suggested from the Knitwright starter chart at ${column}.${age} Check with your factory.` };
}

/** The "Ready for the factory" line for the label map. Open while any entry is only a suggestion. */
export function sizeMapReadiness(maps: readonly SizeLabelMap[]): ReadinessItem {
  const suggested = maps.filter((m) => m.source === "suggested").length;
  const met = maps.length > 0 && suggested === 0;
  return {
    id: "size-label-map",
    met,
    whoActs: "owner",
    sentence: met
      ? "Every size label has a pattern size set by your brand."
      : maps.length === 0
        ? "No size label has a pattern size yet: say which pattern size each label is cut from."
        : `${suggested} size ${suggested === 1 ? "label has" : "labels have"} a suggested pattern size only: say which pattern size each label is cut from.`,
  };
}
