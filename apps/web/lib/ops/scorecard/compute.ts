import { GOLDEN_SAMPLE_STATUSES } from "@/lib/factory/schemas";
import type { OpsException } from "../exceptions/rows";
import { isOverdue } from "../exceptions/rules";
import type { OpsOrder } from "../rows";
import type { Shipment } from "../shipping/rows";
import { fulfilmentOf } from "../shipping/rules";

/**
 * The per-factory scorecard (spec F-O6: "on-time rate, defect rate, colour ΔE pass rate, remake count, and
 * golden samples approved per article"; plan v5 O1, decision 0100).
 *
 * Every figure is counted from rows. Nothing here says whether a figure is acceptable: **the acceptable defect
 * rate is owner question 25 and is unanswered**, so the card shows the rate and says that nothing on file says
 * what passes. A rate with nothing to count from is null, never zero: "none yet" and "none wrong" are not the
 * same thing, and a factory must not look good because nobody has inspected it.
 *
 * "Active only with an approved golden sample" (F-O6) is the one judgement here, and it is not a measurement:
 * the golden sample's state is a row of `factory_capabilities`.
 */

export interface ScorecardReading {
  readonly factoryProfileId: string;
  readonly deltaE: number;
  /** Null: no tolerance was on file, so the reading judges nothing and is counted apart. */
  readonly limitDeltaE: number | null;
}

/** The states of `factory_capabilities.golden_sample_status`, owned by the factory rows (decision 0071). */
export type GoldenSampleState = (typeof GOLDEN_SAMPLE_STATUSES)[number];

export interface ArticleGoldenSample {
  readonly factoryProfileId: string;
  readonly articleCode: string;
  readonly state: GoldenSampleState;
}

export interface ScorecardInput {
  readonly now: Date;
  readonly orders: readonly OpsOrder[];
  readonly shipments: readonly Shipment[];
  readonly inspections: readonly Readonly<{ factoryProfileId: string; result: "pass" | "fail"; sampleSize: number; defectCount: number }>[];
  readonly readings: readonly ScorecardReading[];
  readonly exceptions: readonly OpsException[];
  readonly goldenSamples: readonly ArticleGoldenSample[];
  /** The factories on file, so one with no order yet still gets a card. */
  readonly factories: readonly Readonly<{ slug: string; name: string }>[];
}

export interface FactoryScorecard {
  readonly factoryProfileId: string;
  readonly name: string;
  readonly orders: number;
  readonly pieces: number;
  readonly onTime: Readonly<{ onTime: number; late: number; withoutPromise: number; rate: number | null }>;
  readonly defects: Readonly<{ inspections: number; sampled: number; defective: number; rate: number | null }>;
  readonly colour: Readonly<{ readings: number; judged: number; inside: number; rate: number | null }>;
  readonly remakes: Readonly<{ open: number; overdue: number; total: number }>;
  readonly goldenSamples: readonly ArticleGoldenSample[];
  /** F-O6: a factory is active only with an approved golden sample. */
  readonly isActive: boolean;
  /** What makes this factory a worry, each as a sentence. Empty when nothing on file says anything is wrong. */
  readonly warnings: readonly string[];
}

export const NO_DEFECT_RATE_AGREED =
  "No acceptable defect rate is agreed with any factory, so nothing here says whether this rate passes (owner question 25).";

export const NOT_ACTIVE_WITHOUT_GOLDEN_SAMPLE =
  "Not active: no article has a golden sample signed off at this factory, and a factory-article pair is active only with one.";

/** The one state that makes a factory-article pair active. The value is the factory rows' own (decision 0071). */
const SIGNED_OFF: GoldenSampleState = GOLDEN_SAMPLE_STATUSES[2];

const rate = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

function onTimeOf(orders: readonly OpsOrder[], shipments: readonly Shipment[]): FactoryScorecard["onTime"] {
  let onTime = 0;
  let late = 0;
  let withoutPromise = 0;
  for (const order of orders) {
    const mine = shipments.filter((s) => s.orderId === order.id);
    if (fulfilmentOf(order, mine) !== "shipped") continue;
    if (order.promisedOn === null) withoutPromise += 1;
    else if (mine.reduce((last, s) => (s.shippedOn > last ? s.shippedOn : last), "") <= order.promisedOn) onTime += 1;
    else late += 1;
  }
  return { onTime, late, withoutPromise, rate: rate(onTime, onTime + late) };
}

function warningsOf(card: Omit<FactoryScorecard, "warnings">): readonly string[] {
  const out: string[] = [];
  if (!card.isActive) out.push(NOT_ACTIVE_WITHOUT_GOLDEN_SAMPLE);
  if (card.onTime.late > 0) out.push(`${card.onTime.late} of ${card.onTime.onTime + card.onTime.late} shipped orders went out after the date promised.`);
  if (card.defects.defective > 0) out.push(`${card.defects.defective} defective pieces in ${card.defects.sampled} inspected. ${NO_DEFECT_RATE_AGREED}`);
  if (card.colour.judged > card.colour.inside) out.push(`${card.colour.judged - card.colour.inside} colour readings are over the tolerance this factory works to.`);
  if (card.colour.readings > card.colour.judged) out.push(`${card.colour.readings - card.colour.judged} colour readings had no tolerance on file, so nothing judged them.`);
  if (card.remakes.overdue > 0) out.push(`${card.remakes.overdue} remake lines are past their due date.`);
  return out;
}

function cardFor(input: ScorecardInput, slug: string, name: string): FactoryScorecard {
  const orders = input.orders.filter((o) => o.factoryProfileId === slug);
  const orderIds = new Set(orders.map((o) => o.id));
  const inspections = input.inspections.filter((i) => i.factoryProfileId === slug);
  const readings = input.readings.filter((r) => r.factoryProfileId === slug);
  const judged = readings.filter((r) => r.limitDeltaE !== null);
  const remakes = input.exceptions.filter((e) => e.kind === "remake" && orderIds.has(e.orderId));
  const open = remakes.filter((e) => e.status === "open");
  const goldenSamples = input.goldenSamples.filter((g) => g.factoryProfileId === slug);
  const sampled = inspections.reduce((n, i) => n + i.sampleSize, 0);
  const defective = inspections.reduce((n, i) => n + i.defectCount, 0);
  const base = {
    factoryProfileId: slug,
    name,
    orders: orders.length,
    pieces: orders.reduce((n, o) => n + o.pieces, 0),
    onTime: onTimeOf(orders, input.shipments),
    defects: { inspections: inspections.length, sampled, defective, rate: rate(defective, sampled) },
    colour: {
      readings: readings.length,
      judged: judged.length,
      inside: judged.filter((r) => r.deltaE <= (r.limitDeltaE ?? 0)).length,
      rate: rate(judged.filter((r) => r.deltaE <= (r.limitDeltaE ?? 0)).length, judged.length),
    },
    remakes: { open: open.length, overdue: open.filter((e) => isOverdue(e, input.now)).length, total: remakes.length },
    goldenSamples,
    isActive: goldenSamples.some((g) => g.state === SIGNED_OFF),
  };
  return { ...base, warnings: warningsOf(base) };
}

/** A card per factory on file, plus one per factory an order names that is not on file. By name, then slug. */
export function buildScorecards(input: ScorecardInput): readonly FactoryScorecard[] {
  const names = new Map(input.factories.map((f) => [f.slug, f.name]));
  for (const order of input.orders) if (!names.has(order.factoryProfileId)) names.set(order.factoryProfileId, order.factoryProfileId);
  return [...names.entries()]
    .map(([slug, name]) => cardFor(input, slug, name))
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.factoryProfileId.localeCompare(b.factoryProfileId));
}

/** "82%" or the words that say nothing has been counted yet. Never "0%" for "nothing to count". */
export const percent = (value: number | null): string => (value === null ? "Nothing counted yet" : `${Math.round(value * 100)}%`);
