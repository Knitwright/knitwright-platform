import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/ops/status";

/** The shapes the Orders area reads, checked as they arrive (decision 0143). */

export const ORDER_COLUMNS =
  "id, release_id, project_id, article_id, fabric_key, sizes, pieces, value_minor, currency, release_snapshot, status, promised_on, created_at";

export const orderRow = z.object({
  id: z.uuid(),
  release_id: z.uuid(),
  project_id: z.uuid(),
  article_id: z.string(),
  fabric_key: z.string(),
  sizes: z.record(z.string(), z.number().int()),
  pieces: z.number().int(),
  value_minor: z.number().int().nullable(),
  currency: z.string().nullable(),
  release_snapshot: z.object({ label: z.string().catch(""), number: z.number().int().catch(0) }).partial().catch({}),
  status: z.enum(ORDER_STATUSES),
  promised_on: z.string().nullable(),
  created_at: z.string(),
});
export type OrderRow = z.output<typeof orderRow>;

export const milestoneRow = z.object({
  order_id: z.uuid(),
  qc_passed_at: z.string().nullable(),
  shipped_on: z.string().nullable(),
});

export const trackingSchema = z.object({
  shipments: z.array(
    z.object({
      courier: z.string(),
      tracking_number: z.string(),
      tracking_url: z.string().nullable().catch(null),
      shipped_on: z.string(),
      pieces: z.number().int(),
    }),
  ),
  inspections: z.array(z.object({ at: z.string(), photo_file_ids: z.array(z.string()) })),
});

export const nameRow = z.object({ id: z.uuid(), name: z.string() });
export const runKindRow = z.object({ order_id: z.uuid(), kind: z.enum(["sample", "run"]) });

export const goldenRow = z.object({
  id: z.uuid(),
  product_id: z.uuid(),
  version: z.number().int(),
  state: z.string(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
});
