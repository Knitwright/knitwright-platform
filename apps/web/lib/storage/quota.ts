/**
 * The storage quota of a brand. Security finding S-01; owner decision 2026-09-30: 500 MB.
 *
 * Every stored file counts: uploads, size chart files and generated pictures. The rule
 * itself is kept by the database (supabase/migrations/20260930040000_storage_quota.sql),
 * which refuses a file row that would take the brand past the quota, one upload at a time
 * per brand. The server checks first as well, so a refused file is never sent to storage.
 */

/** 500 MB, counted as 500 x 1024 x 1024 bytes. The migration holds the same number. */
export const BRAND_STORAGE_QUOTA_BYTES = 500 * 1024 * 1024;

/** The error code the database raises when a file would pass the quota. */
export const QUOTA_ERROR_CODE = "KWQ01";

const megabytes = (bytes: number): number => Math.round(bytes / (1024 * 1024));

export const STORAGE_FULL_MESSAGE =
  `Your brand has used its ${megabytes(BRAND_STORAGE_QUOTA_BYTES)} MB of storage, so nothing more can be saved. ` +
  "Delete designs you no longer need, then try again.";

export type StorageRoom = Readonly<{ ok: true }> | Readonly<{ ok: false; message: string }>;

const isAmount = (value: number): boolean => Number.isFinite(value) && value >= 0;

/** Whether a file of `incomingBytes` fits beside the `usedBytes` a brand already stores. */
export function storageRoom(
  usedBytes: number,
  incomingBytes: number,
  quotaBytes: number = BRAND_STORAGE_QUOTA_BYTES,
): StorageRoom {
  if (!isAmount(usedBytes) || !isAmount(incomingBytes) || !isAmount(quotaBytes)) {
    throw new Error("Storage amounts are whole numbers of bytes, zero or more.");
  }
  return usedBytes + incomingBytes <= quotaBytes ? { ok: true } : { ok: false, message: STORAGE_FULL_MESSAGE };
}

/** True for the database's refusal of a file that would pass the quota. */
export const isQuotaRefusal = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === QUOTA_ERROR_CODE;
