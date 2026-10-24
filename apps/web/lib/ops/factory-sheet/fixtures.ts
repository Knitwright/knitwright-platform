import type { RosterRow } from "@/lib/production/contract";
import { DEFAULT_OPS_SETTINGS } from "../settings";
import type { Batch, OpsOrder } from "../rows";
import type { SheetInput } from "./model";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const SAMPLE_BATCH: Batch = { id: ID(100), factoryProfileId: "knitwright-default", fabricKey: "mesh-140", articleId: "team-jersey", cutoffAt: "2026-10-23T17:00:00.000Z" };

export const sampleOrder = (n: number, over: Partial<OpsOrder> = {}): OpsOrder => ({
  id: ID(n), releaseId: ID(900 + n), brandId: ID(800), projectId: ID(700), externalRef: `STORE-100${n}`, factoryProfileId: "knitwright-default", fabricKey: "mesh-140", articleId: "team-jersey",
  sizes: { M: 2, L: 1 }, pieces: 3, valueMinor: null, currency: null, release: { label: `Round ${n}`, number: n, rosterHash: null }, status: "batched", batchId: ID(100),
  cutoffAt: "2026-10-23T17:00:00.000Z", leadTimeDays: null, promisedOn: null, createdAt: "2026-10-21T09:00:00.000Z", ...over,
});

export const ROSTER_3: readonly RosterRow[] = [
  { name: "OKAFOR", number: "10", sizeLabel: "M", cut: "mens", quantity: 1 },
  { name: "ADAMS", number: "7", sizeLabel: "M", cut: "mens", quantity: 1 },
  { name: "LI", number: "22", sizeLabel: "L", cut: "mens", quantity: 1 },
];

/** A sample batch: two orders, one with a team list, one without. No lead time, so no promised date. */
export const SAMPLE_SHEET_INPUT: SheetInput = {
  batch: SAMPLE_BATCH,
  settings: DEFAULT_OPS_SETTINGS,
  orders: [
    { order: sampleOrder(2, { sizes: { XL: 4, M: 2 }, pieces: 6 }), brandName: "Bayside FC", roster: null },
    { order: sampleOrder(1), brandName: "Northside Cricket Club", roster: ROSTER_3 },
  ],
};
