/**
 * What the browser is told about a pattern job, worked out from its row. A pattern is drafted
 * outside the app and can take minutes, so a job is only given up when it has waited well
 * past that.
 */

export type PatternJobStatus = "queued" | "running" | "succeeded" | "failed";

export type PatternJobKind = "single" | "size-set";

export interface PatternJobRow {
  readonly id: string;
  readonly version: number;
  readonly status: PatternJobStatus;
  readonly size_label: string;
  /** One size, or a whole size run that ends in a pattern library block. */
  readonly kind: PatternJobKind;
  readonly block_id: string | null;
  readonly draft: string | null;
  readonly pieces: number | null;
  readonly notes: readonly string[];
  readonly dxf_file_id: string | null;
  readonly preview_file_id: string | null;
  readonly error: string | null;
  readonly created_at: string;
}

export const PATTERN_JOB_COLUMNS =
  "id, version, status, size_label, kind, block_id, draft, pieces, notes, dxf_file_id, preview_file_id, error, created_at" as const;

/** Drafting a custom pattern can take up to eight minutes; the bridge may wait for a person. */
export const PATTERN_STALE_AFTER_MS = 30 * 60 * 1000;

export const PATTERN_STALE_MESSAGE = "The pattern took too long and was stopped. Ask for it again.";

export interface PatternJobView {
  readonly id: string;
  readonly version: number;
  readonly size: string;
  readonly kind: PatternJobKind;
  /** The library block a finished size run was stored as. */
  readonly blockId: string | null;
  readonly status: "waiting" | "drafting" | "ready" | "failed";
  readonly draft: string | null;
  readonly pieces: number | null;
  readonly notes: readonly string[];
  readonly dxfFileId: string | null;
  readonly previewFileId: string | null;
  /** A sentence to show when the job failed. */
  readonly message: string | null;
}

const unfinished = (status: PatternJobStatus): boolean => status === "queued" || status === "running";

export const isPatternStale = (row: Pick<PatternJobRow, "status" | "created_at">, now: Date): boolean =>
  unfinished(row.status) && now.getTime() - new Date(row.created_at).getTime() > PATTERN_STALE_AFTER_MS;

export function patternJobView(row: PatternJobRow, now: Date): PatternJobView {
  const base = {
    id: row.id,
    version: row.version,
    size: row.size_label,
    kind: row.kind,
    blockId: row.block_id,
    draft: null,
    pieces: null,
    notes: [],
    dxfFileId: null,
    previewFileId: null,
    message: null,
  };
  if (isPatternStale(row, now)) return { ...base, status: "failed", message: PATTERN_STALE_MESSAGE };
  if (row.status === "queued") return { ...base, status: "waiting" };
  if (row.status === "running") return { ...base, status: "drafting" };
  if (row.status === "failed") return { ...base, status: "failed", message: row.error };
  return {
    ...base,
    status: "ready",
    draft: row.draft,
    pieces: row.pieces,
    notes: row.notes,
    dxfFileId: row.dxf_file_id,
    previewFileId: row.preview_file_id,
  };
}
