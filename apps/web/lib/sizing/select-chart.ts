import { getType } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { runSystemMismatch } from "./run-system";
import type { SizeChart, SizeRun } from "./schemas";

export type ChartChoice =
  | {
      readonly kind: "found";
      readonly chart: SizeChart;
      readonly run: SizeRun;
      readonly fitNote: string | null;
    }
  | { readonly kind: "none"; readonly message: string };

interface Wanted {
  readonly typeId: string;
  readonly wearer: SizeChart["wearer"];
  readonly options: Readonly<Record<string, { readonly choiceId: string }>>;
}

/**
 * Picks the chart for a design. A chart made for the design fit wins. Otherwise a
 * chart with no fit is used for every fit, and the note says so. Nothing is worked out
 * between fits, and no other fit chart is borrowed.
 */
export function selectChart(set: ChartSet, wanted: Wanted): ChartChoice {
  const type = getType(wanted.typeId);
  if (!type) return { kind: "none", message: `There is no garment type called ${wanted.typeId}.` };
  const candidates = set.charts.filter(
    (chart) => chart.garmentType === wanted.typeId && chart.wearer === wanted.wearer,
  );
  const fit = Object.hasOwn(wanted.options, "fit") ? wanted.options["fit"]?.choiceId : undefined;
  const chart =
    candidates.find((candidate) => fit !== undefined && candidate.fit === fit) ??
    candidates.find((candidate) => candidate.fit === null);
  if (!chart) {
    const others = candidates.map((candidate) => candidate.fit).join(", ");
    const message =
      candidates.length === 0
        ? `There is no size chart yet for ${type.label} for ${wanted.wearer}. Nothing is filled in for you, so type each measurement in.`
        : `There are size charts for ${type.label} for ${wanted.wearer} only for the ${others} fit, and this design is ${fit ?? "not set to a fit"}. Nothing is guessed, so type each measurement in.`;
    return { kind: "none", message };
  }
  const run = set.runs.find((candidate) => candidate.id === chart.sizeRunId);
  if (!run) {
    return {
      kind: "none",
      message: `The size chart for ${type.label} for ${wanted.wearer} names a size run that is missing, so it cannot be used.`,
    };
  }
  const mismatch = runSystemMismatch(run, wanted.typeId, wanted.wearer);
  if (mismatch) return { kind: "none", message: `The size chart for ${type.label} for ${wanted.wearer} cannot be used. ${mismatch}` };
  const fitNote =
    chart.fit === null && fit !== undefined
      ? `This chart does not depend on fit, so it is used for the ${fit} fit as well.`
      : null;
  return { kind: "found", chart, run, fitNote };
}
