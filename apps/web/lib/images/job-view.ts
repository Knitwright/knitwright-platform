import type { View } from "@/lib/flat/model";

/**
 * What the browser is told about a job, worked out from its row. Plan step 14, task 3.
 * A job whose server stopped (a crash, or the platform's time limit) never finishes on
 * its own, so one that is unfinished after a set time counts as failed.
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface JobRow {
  readonly id: string;
  readonly version: number;
  readonly status: JobStatus;
  readonly front_file_id: string | null;
  readonly back_file_id: string | null;
  readonly error: string | null;
  readonly usage_event_id: string | null;
  readonly created_at: string;
}

export const JOB_COLUMNS =
  "id, version, status, front_file_id, back_file_id, error, usage_event_id, created_at" as const;

/** Well past the 60 seconds a request may run (decision record 0002). */
export const JOB_STALE_AFTER_MS = 3 * 60 * 1000;

export const STALE_MESSAGE = "The images took too long and were stopped. The cost has been given back. Try again.";

export interface JobImage {
  readonly view: View;
  readonly fileId: string;
}

export interface JobView {
  readonly id: string;
  readonly version: number;
  readonly status: "working" | "succeeded" | "failed";
  readonly images: readonly JobImage[];
  /** A sentence to show when the job failed. */
  readonly message: string | null;
}

const unfinished = (status: JobStatus): boolean => status === "queued" || status === "running";

export const isStale = (row: JobRow, now: Date): boolean =>
  unfinished(row.status) && now.getTime() - new Date(row.created_at).getTime() > JOB_STALE_AFTER_MS;

const imagesOf = (row: JobRow): JobImage[] => [
  ...(row.front_file_id ? [{ view: "front" as const, fileId: row.front_file_id }] : []),
  ...(row.back_file_id ? [{ view: "back" as const, fileId: row.back_file_id }] : []),
];

export function jobView(row: JobRow, now: Date): JobView {
  const base = { id: row.id, version: row.version };
  if (isStale(row, now)) return { ...base, status: "failed", images: [], message: STALE_MESSAGE };
  if (unfinished(row.status)) return { ...base, status: "working", images: [], message: null };
  if (row.status === "succeeded") return { ...base, status: "succeeded", images: imagesOf(row), message: null };
  return { ...base, status: "failed", images: [], message: row.error };
}
