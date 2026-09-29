/**
 * MADE-UP NUMBERS FOR TESTS ONLY.
 *
 * Every value here is invented and obviously artificial: round numbers with steps of
 * 100 tenths of a millimetre. They are not garment measurements and nobody should use
 * them for a real garment. They must never be loaded as the default charts, and nothing
 * under `lib/sizing/charts/` may import from this folder. A test checks that.
 */
import { listTypes, type Wearer } from "@/lib/garment";
import { pointsThatCanApply } from "../applicable-points";
import { runSuits } from "../run-system";
import type { ChartSet } from "../chart-set";
import type { ChartPoint, SizeChart } from "../schemas";
import { MADE_UP_RUNS } from "./made-up-size-runs";

const BASE_VALUE = 2000;
const VALUE_STEP_BETWEEN_POINTS = 100;
const GRADE_STEP = 100;
const TOLERANCE = 100;
const FIT_ADJUSTMENT = 500;

const MADE_UP_SOURCE = { person: "Test Person", date: "2000-01-01" } as const;

function pointFor(pointId: string, index: number, pairCount: number, offset: number): ChartPoint {
  const baseValue = BASE_VALUE + index * VALUE_STEP_BETWEEN_POINTS + offset;
  const grade =
    index % 2 === 0
      ? ({ kind: "even", step: GRADE_STEP } as const)
      : ({ kind: "steps", steps: Array.from({ length: pairCount }, (_, pair) => GRADE_STEP * (1 + (pair % 2))) } as const);
  return { pointId, baseValue, grade, tolerance: TOLERANCE };
}

/** A made-up chart for one type and wearer. The base size is the middle of the run. */
export function madeUpChart(
  typeId: string,
  wearer: Wearer,
  fit: SizeChart["fit"] = null,
): SizeChart {
  const run = MADE_UP_RUNS.find((candidate) => runSuits(candidate, typeId, wearer));
  const type = listTypes().find((candidate) => candidate.id === typeId);
  if (!run || !type) throw new Error(`No made-up chart can be built for ${typeId} and ${wearer}.`);
  const offset = fit === null ? 0 : FIT_ADJUSTMENT;
  const pairCount = run.sizes.length - 1;
  return {
    wearer,
    garmentType: typeId,
    fit,
    sizeRunId: run.id,
    baseSize: run.sizes[Math.floor(run.sizes.length / 2)] ?? "",
    points: pointsThatCanApply(type).map((point, index) => pointFor(point.id, index, pairCount, offset)),
    source: MADE_UP_SOURCE,
  };
}

/** One made-up chart, with no fit, for every type of every family and every wearer the type offers. */
export const MADE_UP_CHARTS: readonly SizeChart[] = listTypes().flatMap((type) =>
  type.wearers.map((wearer) => madeUpChart(type.id, wearer)),
);

export const MADE_UP_CHART_SET: ChartSet = { runs: MADE_UP_RUNS, charts: MADE_UP_CHARTS };
