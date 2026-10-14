import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { isQuotaRefusal, STORAGE_FULL_MESSAGE } from "@/lib/storage/quota";
import { ensureStorageRoom } from "@/lib/storage/store";
import type { LogoRights } from "@/lib/storage/rights";

/**
 * Where artwork files go. Three kinds, each with the one place and the one type it may have. An SVG is
 * never among them: nothing a browser could run is ever stored, and the exports bucket never allows it.
 */

export type ArtworkFileKind = "artwork" | "artwork-print" | "artwork-vector";

const RULES: Readonly<Record<ArtworkFileKind, Readonly<{ bucket: "uploads" | "exports"; types: Readonly<Record<string, string>> }>>> = {
  // The small copy a browser is shown.
  artwork: { bucket: "uploads", types: { "image/png": "png", "image/jpeg": "jpg" } },
  // The full resolution copy, read only by the server.
  "artwork-print": { bucket: "exports", types: { "image/tiff": "tiff" } },
  // The restricted vector model as JSON.
  "artwork-vector": { bucket: "exports", types: { "application/json": "json" } },
};

export type ArtworkFileInput = Readonly<{
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  kind: ArtworkFileKind;
  contentType: string;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
  rights: LogoRights;
}>;

export type StoredArtworkFile = Readonly<{ id: string; bucket: string; path: string }>;

/** Writes one file and its record. A file whose record fails is removed again. */
export async function writeArtworkFile(file: ArtworkFileInput): Promise<StoredArtworkFile> {
  const rule = RULES[file.kind];
  const extension = rule.types[file.contentType];
  if (!extension || file.bytes.byteLength === 0) throw new Error("This kind of file is not stored as artwork.");
  await ensureStorageRoom(file.admin, file.brandId, file.bytes.byteLength);

  const id = randomUUID();
  // The path is built from ids and a fixed extension. A name from the person is never part of it.
  const path = `${file.brandId}/${file.kind}/${id}.${extension}`;
  const files = file.admin.storage.from(rule.bucket);
  const upload = await files.upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (upload.error) throw new Error("The file could not be stored.", { cause: upload.error });

  const record = await file.admin.from("files").insert({
    id,
    brand_id: file.brandId,
    bucket: rule.bucket,
    path,
    kind: file.kind,
    content_type: file.contentType,
    bytes: file.bytes.byteLength,
    width: file.width,
    height: file.height,
    created_by: file.userId,
    // The files table keeps the rights confirmation on plain artwork files only; the artwork's own row keeps it too.
    ...(file.kind === "artwork"
      ? { rights_confirmed_by: file.rights.confirmedBy, rights_confirmed_at: file.rights.confirmedAt, rights_wording_version: file.rights.wordingVersion }
      : {}),
  });
  if (record.error) {
    try {
      await files.remove([path]);
    } catch {
      // The record error is the one to report.
    }
    if (isQuotaRefusal(record.error)) throw new AppError("over_quota", STORAGE_FULL_MESSAGE, undefined, { cause: record.error });
    throw new Error("The file's record could not be written.", { cause: record.error });
  }
  return { id, bucket: rule.bucket, path };
}

/** Removes stored files and their records, for a brand. Used to undo a half-finished upload and to delete an artwork. */
export async function removeArtworkFiles(admin: SupabaseClient, brandId: string, files: readonly StoredArtworkFile[]): Promise<void> {
  for (const file of files) {
    try {
      await admin.storage.from(file.bucket).remove([file.path]);
    } catch {
      // The record is removed all the same; a leftover object is not reachable without it.
    }
    await admin.from("files").delete().eq("id", file.id).eq("brand_id", brandId);
  }
}
