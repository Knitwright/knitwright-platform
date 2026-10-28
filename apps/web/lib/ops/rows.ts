import { z } from "zod";
import type { OrderGroup } from "./grouping";
import { DEFAULT_OPS_SETTINGS, type OpsSettings } from "./settings";
import { ORDER_STATUSES, type OrderStatus } from "./status";

const releaseSnapshot = z.object({
  label: z.string(),
  number: z.number().int(),
  rosterHash: z.string().nullable().optional(),
  files: z.number().int().optional(),
});

const orderRow = z.object({
  id: z.uuid(),
  release_id: z.uuid(),
  brand_id: z.uuid(),
  project_id: z.uuid(),
  external_ref: z.string(),
  factory_profile_id: z.string(),
  fabric_key: z.string(),
  article_id: z.string(),
  sizes: z.record(z.string(), z.number().int()),
  pieces: z.number().int(),
  value_minor: z.number().int().nullable(),
  currency: z.string().nullable(),
  release_snapshot: releaseSnapshot,
  status: z.enum(ORDER_STATUSES),
  batch_id: z.uuid().nullable(),
  cutoff_at: z.string(),
  lead_time_days: z.number().int().nullable(),
  promised_on: z.string().nullable(),
  created_at: z.string(),
});

export interface OpsOrder {
  readonly id: string;
  readonly releaseId: string;
  readonly brandId: string;
  readonly projectId: string;
  readonly externalRef: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly articleId: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly valueMinor: number | null;
  readonly currency: string | null;
  readonly release: Readonly<{ label: string; number: number; rosterHash: string | null }>;
  readonly status: OrderStatus;
  readonly batchId: string | null;
  /** ISO time, always in UTC. */
  readonly cutoffAt: string;
  readonly leadTimeDays: number | null;
  /** A date, year-month-day, or null while none is promised. */
  readonly promisedOn: string | null;
  readonly createdAt: string;
}

const iso = (text: string): string => new Date(text).toISOString();

export const toOrder = (data: unknown): OpsOrder => {
  const r = orderRow.parse(data);
  return {
    id: r.id,
    releaseId: r.release_id,
    brandId: r.brand_id,
    projectId: r.project_id,
    externalRef: r.external_ref,
    factoryProfileId: r.factory_profile_id,
    fabricKey: r.fabric_key,
    articleId: r.article_id,
    sizes: r.sizes,
    pieces: r.pieces,
    valueMinor: r.value_minor,
    currency: r.currency,
    release: { label: r.release_snapshot.label, number: r.release_snapshot.number, rosterHash: r.release_snapshot.rosterHash ?? null },
    status: r.status,
    batchId: r.batch_id,
    cutoffAt: iso(r.cutoff_at),
    leadTimeDays: r.lead_time_days,
    promisedOn: r.promised_on,
    createdAt: iso(r.created_at),
  };
};

const batchRow = z.object({
  id: z.uuid(),
  factory_profile_id: z.string(),
  fabric_key: z.string(),
  article_id: z.string(),
  cutoff_at: z.string(),
});
export interface Batch extends Omit<OrderGroup, "orderIds"> {
  readonly id: string;
}
export const toBatch = (data: unknown): Batch => {
  const r = batchRow.parse(data);
  return { id: r.id, factoryProfileId: r.factory_profile_id, fabricKey: r.fabric_key, articleId: r.article_id, cutoffAt: iso(r.cutoff_at) };
};

const eventRow = z.object({
  id: z.uuid(),
  kind: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string(),
  promised_on: z.string().nullable(),
  note: z.string(),
  at: z.string(),
});
export interface OrderEvent {
  readonly id: string;
  readonly kind: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly promisedOn: string | null;
  readonly note: string;
  readonly at: string;
}
export const toEvent = (data: unknown): OrderEvent => {
  const r = eventRow.parse(data);
  return { id: r.id, kind: r.kind, fromStatus: r.from_status, toStatus: r.to_status, promisedOn: r.promised_on, note: r.note, at: iso(r.at) };
};

const settingsRow = z.object({
  cutoff_weekday: z.number().int().min(0).max(6),
  cutoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  lead_time_days: z.number().int().nullable(),
  label: z.string(),
});

/** The settings row, or the labelled default when the row cannot be read. */
export const toSettings = (data: unknown): OpsSettings => {
  const parsed = settingsRow.safeParse(data);
  if (!parsed.success) return DEFAULT_OPS_SETTINGS;
  const [hh, mm] = parsed.data.cutoff_time.split(":").map(Number);
  return { cutoffWeekday: parsed.data.cutoff_weekday, cutoffMinutes: (hh ?? 0) * 60 + (mm ?? 0), leadTimeDays: parsed.data.lead_time_days, label: parsed.data.label };
};
