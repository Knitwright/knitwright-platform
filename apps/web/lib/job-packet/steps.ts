import type { OrderStatus } from "@/lib/ops/status";

/**
 * What a factory may record through its job packet, and what each step does to the batch's orders. The SQL
 * function `job_packet_record` holds the same table; tests/integration/job-packets.test.ts holds the two together.
 */

export const FACTORY_STEPS = ["received", "in_production", "ready_for_qc"] as const;
export type FactoryStep = (typeof FACTORY_STEPS)[number];

/** How long a link lasts when ops does not say: four weeks covers a batch from cut-off to QC. */
export const DEFAULT_PACKET_DAYS = 28;
/** The longest a link may last, as the database allows. */
export const MAX_PACKET_DAYS = 90;

/** The longest note a factory may write, as the database allows. */
export const NOTE_MAX = 1000;

export const FACTORY_EVENT_KINDS = [...FACTORY_STEPS, "note", "photo"] as const;
export type FactoryEventKind = (typeof FACTORY_EVENT_KINDS)[number];

export const EVENT_LABELS: Readonly<Record<FactoryEventKind, string>> = {
  received: "Received",
  in_production: "In production",
  ready_for_qc: "Ready for QC",
  note: "Note",
  photo: "Photo",
};

/** The order status a step moves from and to. Orders at any other status are left as they are. */
export const ORDER_MOVE: Readonly<Record<FactoryStep, Readonly<{ from: OrderStatus; to: OrderStatus }>>> = {
  received: { from: "batched", to: "received" },
  in_production: { from: "received", to: "in_production" },
  ready_for_qc: { from: "in_production", to: "ready" },
};

const PREVIOUS: Readonly<Record<FactoryStep, FactoryStep | null>> = {
  received: null,
  in_production: "received",
  ready_for_qc: "in_production",
};

export const isFactoryStep = (kind: string): kind is FactoryStep => (FACTORY_STEPS as readonly string[]).includes(kind);

/** Whether a step may be recorded after the last one: one at a time, in order, never twice, never back. */
export const canRecordStep = (last: FactoryStep | null, step: FactoryStep): boolean => PREVIOUS[step] === last;

/** The one step the factory may press next, or null once the batch is ready for QC. */
export const nextStep = (last: FactoryStep | null): FactoryStep | null => FACTORY_STEPS.find((step) => canRecordStep(last, step)) ?? null;

/** The last step among a batch's events, given oldest first. */
export const lastStep = (events: readonly Readonly<{ kind: FactoryEventKind }>[]): FactoryStep | null =>
  events.reduce<FactoryStep | null>((last, event) => (isFactoryStep(event.kind) ? event.kind : last), null);
