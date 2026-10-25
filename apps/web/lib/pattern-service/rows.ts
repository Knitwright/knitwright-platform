import { z } from "zod";
import { STATUSES, type PatternRequestStatus } from "./transitions";

export const REQUEST_COLUMNS =
  "id, brand_id, project_id, design_version, article_id, status, snapshot_hash, quoted_price_credits, quoted_turnaround_days, decline_reason, file_ids, reviewed_by, reviewed_on, created_at, updated_at";

export const EVENT_COLUMNS = "id, request_id, kind, from_status, to_status, note, at";

const requestRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  project_id: z.uuid(),
  design_version: z.number().int(),
  article_id: z.string(),
  status: z.enum(STATUSES),
  snapshot_hash: z.string(),
  quoted_price_credits: z.number().int().nullable(),
  quoted_turnaround_days: z.number().int().nullable(),
  decline_reason: z.string().nullable(),
  file_ids: z.array(z.string()),
  reviewed_by: z.string().nullable(),
  reviewed_on: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export interface PatternRequest {
  readonly id: string;
  readonly brandId: string;
  readonly projectId: string;
  readonly designVersion: number;
  readonly articleId: string;
  readonly status: PatternRequestStatus;
  readonly snapshotHash: string;
  readonly quotedPriceCredits: number | null;
  readonly quotedTurnaroundDays: number | null;
  readonly declineReason: string | null;
  readonly fileIds: readonly string[];
  readonly reviewedBy: string | null;
  /** YYYY-MM-DD. */
  readonly reviewedOn: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const toRequest = (data: unknown): PatternRequest => {
  const r = requestRow.parse(data);
  return {
    id: r.id,
    brandId: r.brand_id,
    projectId: r.project_id,
    designVersion: r.design_version,
    articleId: r.article_id,
    status: r.status,
    snapshotHash: r.snapshot_hash,
    quotedPriceCredits: r.quoted_price_credits,
    quotedTurnaroundDays: r.quoted_turnaround_days,
    declineReason: r.decline_reason,
    fileIds: r.file_ids,
    reviewedBy: r.reviewed_by,
    reviewedOn: r.reviewed_on,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

const eventRow = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  kind: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string(),
  note: z.string(),
  at: z.string(),
});

export interface PatternEvent {
  readonly id: string;
  readonly requestId: string;
  readonly kind: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly note: string;
  readonly at: string;
}

export const toEvent = (data: unknown): PatternEvent => {
  const r = eventRow.parse(data);
  return { id: r.id, requestId: r.request_id, kind: r.kind, fromStatus: r.from_status, toStatus: r.to_status, note: r.note, at: r.at };
};
