import { nextCutoff } from "../cutoff";
import type { OpsException } from "../exceptions/rows";
import { isOverdue } from "../exceptions/rules";
import type { Inspection } from "../qc/rows";
import type { OpsOrder } from "../rows";
import type { OpsSettings } from "../settings";
import type { Shipment } from "../shipping/rows";
import { fulfilmentOf } from "../shipping/rules";

export interface MetricsInput {
  readonly now: Date;
  readonly orders: readonly OpsOrder[];
  readonly shipments: readonly Shipment[];
  readonly inspections: readonly Pick<Inspection, "factoryProfileId" | "sampleSize" | "defectCount">[];
  readonly exceptions: readonly OpsException[];
  readonly settings: OpsSettings;
}

export interface FactoryDefects {
  readonly factoryProfileId: string;
  readonly inspections: number;
  readonly sampled: number;
  readonly defective: number;
  /** Defective pieces over pieces sampled, 0 to 1. */
  readonly rate: number;
}

export interface Metrics {
  /** Monday 00:00 UTC of the week `now` is in, as an ISO time. */
  readonly weekStart: string;
  readonly ordersThisWeek: number;
  readonly piecesInProduction: number;
  readonly onTime: Readonly<{ onTime: number; late: number; withoutPromise: number; rate: number | null }>;
  readonly defectsByFactory: readonly FactoryDefects[];
  readonly remakesOpen: number;
  readonly remakesOverdue: number;
  /** Value of orders in a batch that are not fully shipped, by currency, as the Store gave it; `unpriced` orders gave none. */
  readonly batchValue: Readonly<{ byCurrency: readonly { currency: string; minor: number }[]; unpriced: number }>;
  readonly nextCutoff: string;
}

const DAY = 86_400_000;

/** Monday 00:00 UTC of the week the time falls in. */
export function weekStart(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight - ((now.getUTCDay() + 6) % 7) * DAY);
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function onTimeOf(orders: readonly OpsOrder[], shipments: readonly Shipment[]): Metrics["onTime"] {
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
  const judged = onTime + late;
  return { onTime, late, withoutPromise, rate: judged === 0 ? null : onTime / judged };
}

function defectsOf(inspections: MetricsInput["inspections"]): readonly FactoryDefects[] {
  const by = new Map<string, { inspections: number; sampled: number; defective: number }>();
  for (const i of inspections) {
    const was = by.get(i.factoryProfileId) ?? { inspections: 0, sampled: 0, defective: 0 };
    by.set(i.factoryProfileId, { inspections: was.inspections + 1, sampled: was.sampled + i.sampleSize, defective: was.defective + i.defectCount });
  }
  return [...by.entries()].sort(([a], [b]) => byText(a, b)).map(([factoryProfileId, v]) => ({ factoryProfileId, ...v, rate: v.sampled === 0 ? 0 : v.defective / v.sampled }));
}

function batchValueOf(orders: readonly OpsOrder[], shipments: readonly Shipment[]): Metrics["batchValue"] {
  const open = orders.filter((o) => o.batchId !== null && fulfilmentOf(o, shipments.filter((s) => s.orderId === o.id)) !== "shipped");
  const sums = new Map<string, number>();
  for (const o of open) if (o.valueMinor !== null && o.currency !== null) sums.set(o.currency, (sums.get(o.currency) ?? 0) + o.valueMinor);
  return {
    byCurrency: [...sums.entries()].sort(([a], [b]) => byText(a, b)).map(([currency, minor]) => ({ currency, minor })),
    unpriced: open.filter((o) => o.valueMinor === null).length,
  };
}

/** The console's numbers, from the rows and nothing else. Pure: the same rows and clock give the same numbers. */
export function computeMetrics(input: MetricsInput): Metrics {
  const start = weekStart(input.now);
  const remakes = input.exceptions.filter((e) => e.kind === "remake" && e.status === "open");
  return {
    weekStart: start.toISOString(),
    ordersThisWeek: input.orders.filter((o) => Date.parse(o.createdAt) >= start.getTime() && Date.parse(o.createdAt) <= input.now.getTime()).length,
    piecesInProduction: input.orders.filter((o) => o.status === "received" || o.status === "in_production").reduce((n, o) => n + o.pieces, 0),
    onTime: onTimeOf(input.orders, input.shipments),
    defectsByFactory: defectsOf(input.inspections),
    remakesOpen: remakes.length,
    remakesOverdue: remakes.filter((e) => isOverdue(e, input.now)).length,
    batchValue: batchValueOf(input.orders, input.shipments),
    nextCutoff: nextCutoff(input.now, input.settings).toISOString(),
  };
}
