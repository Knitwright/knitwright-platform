import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { AppError } from "@/lib/server/core/errors";
import { ensureStorageRoom } from "@/lib/storage/store";
import { isQuotaRefusal, STORAGE_FULL_MESSAGE } from "@/lib/storage/quota";
import type { Intake } from "./intake";
import { REFUSALS } from "./messages";
import { COLUMNS, parseRow, toRecord, type ArtworkRecord } from "./records";

/** Who said they may use the artwork on garments, when, and the words they saw (decision 0025). */
export type Rights = Readonly<{ confirmedBy: string; confirmedAt: string; wordingVersion: string }>;

export const rightsFor = (input: Readonly<{ confirmed: boolean; userId: string; now: Date }>): Rights => {
  if (!input.confirmed) throw new AppError("invalid_input", REFUSALS.rightsMissing, { rights: [REFUSALS.rightsMissing] });
  return { confirmedBy: input.userId, confirmedAt: input.now.toISOString(), wordingVersion: LOGO_RIGHTS.version };
};

type FileKind = "artwork" | "artwork-print" | "artwork-vector";
type Bucket = "uploads" | "exports";
type Written = Readonly<{ id: string; bucket: Bucket; path: string }>;

type FileInput = Readonly<{
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  kind: FileKind;
  bucket: Bucket;
  extension: string;
  contentType: string;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
  rights: Rights | null;
}>;

/** Writes one file and its record. The path is made by the server from ids; no part of a file name is used. */
const writeFile = async (input: FileInput): Promise<Written> => {
  const id = randomUUID();
  const path = `${input.brandId}/${input.kind}/${id}.${input.extension}`;
  const bucket = input.admin.storage.from(input.bucket);
  const upload = await bucket.upload(path, input.bytes, { contentType: input.contentType, upsert: false });
  if (upload.error) throw new Error("The file could not be stored.", { cause: upload.error });
  const record = await input.admin.from("files").insert({
    id,
    brand_id: input.brandId,
    bucket: input.bucket,
    path,
    kind: input.kind,
    content_type: input.contentType,
    bytes: input.bytes.byteLength,
    width: input.width,
    height: input.height,
    created_by: input.userId,
    ...(input.rights
      ? {
          rights_confirmed_by: input.rights.confirmedBy,
          rights_confirmed_at: input.rights.confirmedAt,
          rights_wording_version: input.rights.wordingVersion,
        }
      : {}),
  });
  if (record.error) {
    await bucket.remove([path]).catch(() => undefined);
    if (isQuotaRefusal(record.error)) throw new AppError("over_quota", STORAGE_FULL_MESSAGE, undefined, { cause: record.error });
    throw new Error("The file's record could not be written.", { cause: record.error });
  }
  return { id, bucket: input.bucket, path };
};

/** Removes files that were written for an artwork that did not complete. Best effort: nothing more can be done on failure. */
export const discard = async (admin: SupabaseClient, brandId: string, written: readonly Written[]): Promise<void> => {
  for (const bucket of ["uploads", "exports"] as const) {
    const paths = written.filter((file) => file.bucket === bucket).map((file) => file.path);
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths).catch(() => undefined);
  }
  if (written.length > 0) {
    await admin.from("files").delete().in("id", written.map((file) => file.id)).eq("brand_id", brandId);
  }
};

export type StoreInput = Readonly<{ admin: SupabaseClient; brandId: string; userId: string; intake: Intake; rights: Rights }>;

const copies = (intake: Intake) => [
  ...(intake.print ? [intake.print] : []),
  ...(intake.vector ? [intake.vector] : []),
  intake.screen,
];

/**
 * Stores an intake: the screen copy (an ordinary artwork file), the print copy or the vector JSON, and the record.
 * Either all of it is stored or none: a failure removes what was written. The original file is never stored.
 */
export const storeArtwork = async (input: StoreInput): Promise<ArtworkRecord> => {
  const { admin, brandId, userId, intake, rights } = input;
  await ensureStorageRoom(admin, brandId, copies(intake).reduce((total, copy) => total + copy.bytes.byteLength, 0));
  const written: Written[] = [];
  const put = async (kind: FileKind, bucket: Bucket, copy: Intake["screen"] | NonNullable<Intake["print"]>, withRights: boolean) => {
    const file = await writeFile({
      admin, brandId, userId, kind, bucket,
      extension: copy.extension,
      contentType: copy.contentType,
      bytes: copy.bytes,
      width: "width" in copy ? copy.width : null,
      height: "height" in copy ? copy.height : null,
      rights: withRights ? rights : null,
    });
    written.push(file);
    return file.id;
  };
  try {
    const screenFileId = await put("artwork", "uploads", intake.screen, true);
    const printFileId = intake.print ? await put("artwork-print", "exports", intake.print, false) : null;
    const vectorFileId = intake.vector ? await put("artwork-vector", "exports", intake.vector, false) : null;
    const inserted = await admin
      .from("user_artworks")
      .insert({
        brand_id: brandId,
        kind: intake.kind,
        source_format: intake.sourceFormat,
        label: intake.label,
        source_sha256: intake.sourceSha256,
        print_sha256: intake.printSha256,
        print_file_id: printFileId,
        vector_file_id: vectorFileId,
        screen_file_id: screenFileId,
        width_px: intake.widthPx,
        height_px: intake.heightPx,
        dpi_meta: intake.dpiMeta,
        colour_space: intake.colourSpace,
        profile_name: intake.profileName,
        has_alpha: intake.hasAlpha,
        rights_confirmed_by: rights.confirmedBy,
        rights_confirmed_at: rights.confirmedAt,
        rights_wording_version: rights.wordingVersion,
        warnings: intake.warnings,
        created_by: userId,
      })
      .select(COLUMNS)
      .single();
    if (inserted.error) throw new Error("The artwork's record could not be written.", { cause: inserted.error });
    return toRecord(parseRow(inserted.data));
  } catch (error) {
    await discard(admin, brandId, written);
    throw error;
  }
};
