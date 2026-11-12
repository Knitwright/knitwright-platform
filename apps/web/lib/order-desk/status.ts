import type { OrderStatus } from "@/lib/ops/status";

/**
 * Where a customer's order is (spec F-T7, decision 0143). F-T7 names seven steps:
 * paid → in batch → at factory → in production → QC passed → shipped → delivered.
 *
 * Only some of them are real today:
 *   * "Paid" needs a payment, and payments arrive with workstream C1. Until then the first step is
 *     "Placed": the order reached production through `submit_order_for_production`.
 *   * In batch, At factory and In production are the ops states `batched`, `received` and
 *     `in_production`. `ready` is the factory saying it is done while QC has not passed yet.
 *   * QC passed is a passing inspection; Shipped is a parcel on file.
 *   * Delivered needs a courier's delivery scan, which nothing records yet, so no order reaches it.
 */

export const TRACK_STEPS = ["placed", "in_batch", "at_factory", "in_production", "qc_passed", "shipped", "delivered"] as const;
export type TrackStep = (typeof TRACK_STEPS)[number];

export const STEP_LABELS: Readonly<Record<TrackStep, string>> = {
  placed: "Placed",
  in_batch: "In batch",
  at_factory: "At factory",
  in_production: "In production",
  qc_passed: "QC passed",
  shipped: "Shipped",
  delivered: "Delivered",
};

export type CustomerStatus = TrackStep | "on_hold" | "awaiting_qc";
export type StatusTone = "ok" | "warn" | "bad" | "info" | "neutral";

export const STATUS_LABELS: Readonly<Record<CustomerStatus, string>> = {
  ...STEP_LABELS,
  on_hold: "On hold",
  awaiting_qc: "Awaiting QC",
};

export const STATUS_TONES: Readonly<Record<CustomerStatus, StatusTone>> = {
  placed: "neutral",
  on_hold: "bad",
  in_batch: "info",
  at_factory: "info",
  in_production: "warn",
  awaiting_qc: "warn",
  qc_passed: "ok",
  shipped: "ok",
  delivered: "ok",
};

const FROM_OPS: Readonly<Record<OrderStatus, CustomerStatus>> = {
  submitted: "placed",
  held: "on_hold",
  batched: "in_batch",
  received: "at_factory",
  in_production: "in_production",
  ready: "awaiting_qc",
};

export interface Milestones {
  readonly qcPassedAt: string | null;
  readonly shippedOn: string | null;
}

export const NO_MILESTONES: Milestones = { qcPassedAt: null, shippedOn: null };

/** The status a customer sees: a parcel beats a passing inspection, which beats the ops state. */
export function customerStatus(ops: OrderStatus, milestones: Milestones): CustomerStatus {
  if (milestones.shippedOn !== null) return "shipped";
  if (milestones.qcPassedAt !== null) return "qc_passed";
  return FROM_OPS[ops];
}

/** How far along the timeline an order is: the index of the last step reached. */
export function reachedStep(status: CustomerStatus): number {
  if (status === "on_hold") return 0;
  if (status === "awaiting_qc") return TRACK_STEPS.indexOf("in_production");
  return TRACK_STEPS.indexOf(status);
}

/** The status chips over the table (08 v3.5). Awaiting approval, Delivered and Cancelled match nothing yet. */
export const FILTERS = [
  { id: "all", label: "All" },
  { id: "on_hold", label: "On hold" },
  { id: "awaiting_approval", label: "Awaiting approval" },
  { id: "in_production", label: "In production" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
] as const;
export type FilterId = (typeof FILTERS)[number]["id"];

const IN_PRODUCTION: readonly CustomerStatus[] = ["in_batch", "at_factory", "in_production", "awaiting_qc", "qc_passed"];

export function matchesFilter(filter: FilterId, status: CustomerStatus): boolean {
  switch (filter) {
    case "all":
      return true;
    case "on_hold":
      return status === "on_hold";
    case "in_production":
      return IN_PRODUCTION.includes(status);
    case "shipped":
      return status === "shipped";
    case "delivered":
      return status === "delivered";
    default:
      // No order is awaiting approval or cancelled: neither state exists in production yet.
      return false;
  }
}

export const filterOf = (value: unknown): FilterId => FILTERS.find((f) => f.id === value)?.id ?? "all";
