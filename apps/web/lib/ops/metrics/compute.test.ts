import { describe, expect, it } from "vitest";
import { DEFAULT_OPS_SETTINGS } from "../settings";
import { sampleOrder } from "../factory-sheet/fixtures";
import type { OpsException } from "../exceptions/rows";
import type { Shipment } from "../shipping/rows";
import { computeMetrics, weekStart, type MetricsInput } from "./compute";

const NOW = new Date("2026-10-28T10:00:00Z"); // a Wednesday
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let shipments = 0;
const ship = (orderId: string, shippedOn: string, sizes: Record<string, number>): Shipment => ({
  id: ID(500 + ++shipments), orderId, provider: "manual", courier: "DHL", trackingNumber: "T", shippedOn, sizes, pieces: Object.values(sizes).reduce((n, v) => n + v, 0), note: "", at: `${shippedOn}T09:00:00.000Z`,
});
const exception = (n: number, over: Partial<OpsException> = {}): OpsException => ({ id: ID(n), orderId: ID(1), kind: "remake", status: "open", owner: "Sam", dueOn: "2026-11-05", detail: {}, note: "", resolution: null, resolvedOn: null, createdAt: "2026-10-27T10:00:00.000Z", ...over });
const empty: MetricsInput = { now: NOW, orders: [], shipments: [], inspections: [], exceptions: [], settings: DEFAULT_OPS_SETTINGS };

describe("weekStart", () => {
  it("is Monday 00:00 UTC, including on a Sunday and a Monday", () => {
    expect(weekStart(NOW).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(weekStart(new Date("2026-11-01T23:59:59Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(weekStart(new Date("2026-10-26T00:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("computeMetrics with nothing", () => {
  it("is zeros and nulls, never made-up numbers, and still knows the next cut-off", () => {
    const m = computeMetrics(empty);
    expect(m).toMatchObject({ ordersThisWeek: 0, piecesInProduction: 0, remakesOpen: 0, remakesOverdue: 0, defectsByFactory: [] });
    expect(m.onTime).toEqual({ onTime: 0, late: 0, withoutPromise: 0, rate: null });
    expect(m.batchValue).toEqual({ byCurrency: [], unpriced: 0 });
    expect(m.nextCutoff).toBe("2026-10-30T17:00:00.000Z"); // Friday 17:00 UTC
  });
});

describe("computeMetrics", () => {
  it("counts orders made this week only", () => {
    const orders = [sampleOrder(1, { createdAt: "2026-10-26T00:00:00.000Z" }), sampleOrder(2, { createdAt: "2026-10-25T23:59:59.000Z" }), sampleOrder(3, { createdAt: "2026-10-28T09:59:59.000Z" }), sampleOrder(4, { createdAt: "2026-10-28T10:00:01.000Z" })];
    expect(computeMetrics({ ...empty, orders }).ordersThisWeek).toBe(2);
  });

  it("counts pieces at the factory, received and in production only", () => {
    const orders = (["submitted", "batched", "held", "received", "in_production", "ready"] as const).map((status, i) => sampleOrder(i + 1, { status, pieces: 10 }));
    expect(computeMetrics({ ...empty, orders }).piecesInProduction).toBe(20);
  });

  it("judges on time against the promise, from the last parcel, and leaves unpromised orders out of the rate", () => {
    const orders = [
      sampleOrder(1, { pieces: 3, promisedOn: "2026-11-10", status: "ready" }),
      sampleOrder(2, { pieces: 3, promisedOn: "2026-11-10", status: "ready" }),
      sampleOrder(3, { pieces: 3, promisedOn: null, status: "ready" }),
      sampleOrder(4, { pieces: 3, promisedOn: "2026-11-10", status: "ready" }),
      sampleOrder(5, { pieces: 3, promisedOn: "2026-11-10", status: "ready" }),
    ];
    const shipments = [
      ship(orders[0]!.id, "2026-11-10", { M: 3 }), // on the day: on time
      ship(orders[1]!.id, "2026-11-08", { M: 1 }), ship(orders[1]!.id, "2026-11-11", { M: 2 }), // last parcel late
      ship(orders[2]!.id, "2026-11-01", { M: 3 }), // no promise
      ship(orders[3]!.id, "2026-11-20", { M: 1 }), // part shipped: not judged yet
    ];
    expect(computeMetrics({ ...empty, orders, shipments }).onTime).toEqual({ onTime: 1, late: 1, withoutPromise: 1, rate: 0.5 });
  });

  it("works out the defect rate by factory in name order", () => {
    const m = computeMetrics({ ...empty, inspections: [
      { factoryProfileId: "b", sampleSize: 10, defectCount: 1 },
      { factoryProfileId: "a", sampleSize: 20, defectCount: 0 },
      { factoryProfileId: "b", sampleSize: 10, defectCount: 3 },
    ] });
    expect(m.defectsByFactory).toEqual([
      { factoryProfileId: "a", inspections: 1, sampled: 20, defective: 0, rate: 0 },
      { factoryProfileId: "b", inspections: 2, sampled: 20, defective: 4, rate: 0.2 },
    ]);
  });

  it("counts open remakes and how many are overdue, ignoring other kinds and resolved ones", () => {
    const exceptions = [
      exception(1), exception(2, { dueOn: "2026-10-27" }), exception(3, { kind: "lost_parcel", dueOn: "2026-10-01" }),
      exception(4, { status: "resolved", dueOn: "2026-10-01", resolution: "Done", resolvedOn: "2026-10-02" }),
    ];
    expect(computeMetrics({ ...empty, exceptions })).toMatchObject({ remakesOpen: 2, remakesOverdue: 1 });
  });

  it("adds the value of orders still in a batch by currency, as the Store gave it, and counts unpriced ones", () => {
    const orders = [
      sampleOrder(1, { valueMinor: 100_00, currency: "AUD", pieces: 3 }),
      sampleOrder(2, { valueMinor: 50_00, currency: "AUD", pieces: 3 }),
      sampleOrder(3, { valueMinor: 70_00, currency: "GBP", pieces: 3 }),
      sampleOrder(4, { valueMinor: null, currency: null, pieces: 3 }),
      sampleOrder(5, { valueMinor: 999_00, currency: "AUD", pieces: 3, batchId: null, status: "submitted" }),
      sampleOrder(6, { valueMinor: 888_00, currency: "AUD", pieces: 3 }),
    ];
    const shipments = [ship(orders[5]!.id, "2026-10-27", { M: 3 })];
    expect(computeMetrics({ ...empty, orders, shipments }).batchValue).toEqual({ byCurrency: [{ currency: "AUD", minor: 150_00 }, { currency: "GBP", minor: 70_00 }], unpriced: 1 });
  });

  it("does not depend on the order rows arrive in", () => {
    const orders = [1, 2, 3].map((n) => sampleOrder(n, { valueMinor: n * 100, currency: n === 2 ? "GBP" : "AUD" }));
    expect(computeMetrics({ ...empty, orders })).toEqual(computeMetrics({ ...empty, orders: [...orders].reverse() }));
  });
});
