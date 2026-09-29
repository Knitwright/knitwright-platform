import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sheetKind } from "@/lib/charts/container";
import { AppError } from "@/lib/server/core/errors";
import { checkImage } from "./image";

/**
 * The one way a file enters storage. The image is checked and rewritten first, then
 * written by the server: browsers have no right to write to storage themselves.
 *
 * The caller must already have confirmed that the user belongs to the brand. The
 * request wrappers do that for every route with `auth: "member"`.
 */

export const IMAGE_KINDS = ["artwork", "sketch", "photo"] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];

/** What the server may store. "render" is a generated picture (plan step 14); no user uploads one. */
export type StoredKind = ImageKind | "render";

/** Uploads and generated pictures are kept apart, as the buckets were made for. */
const bucketFor = (kind: StoredKind | typeof CHART_KIND): "uploads" | "images" =>
  kind === "render" ? "images" : "uploads";

export type StoreImageInput = Readonly<{
  /** Full access. Used to write the file and its record. */
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  kind: StoredKind;
  bytes: Uint8Array;
  /** The type the browser stated. The content decides, so it is not used. */
  statedType: string;
}>;

export type StoredFile = Readonly<{
  id: string;
  brandId: string;
  kind: StoredKind;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
}>;

type FileRecord = Readonly<{
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  kind: StoredKind | typeof CHART_KIND;
  extension: string;
  contentType: string;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
}>;

/** Writes checked bytes and their record. A file whose record fails is removed again. */
const writeFile = async (file: FileRecord): Promise<string> => {
  const id = randomUUID();
  const path = `${file.brandId}/${file.kind}/${id}.${file.extension}`;
  const bucket = bucketFor(file.kind);
  const files = file.admin.storage.from(bucket);

  const upload = await files.upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (upload.error) throw new Error("The file could not be stored.", { cause: upload.error });

  const record = await file.admin.from("files").insert({
    id,
    brand_id: file.brandId,
    bucket,
    path,
    kind: file.kind,
    content_type: file.contentType,
    bytes: file.bytes.byteLength,
    width: file.width,
    height: file.height,
    created_by: file.userId,
  });
  if (record.error) {
    // A file with no record could never be found again. Remove it. If that fails too,
    // the record error is still the one to report, so the cleanup error is set aside.
    try {
      await files.remove([path]);
    } catch {
      // Nothing more can be done here.
    }
    throw new Error("The file's record could not be written.", { cause: record.error });
  }
  return id;
};

export const storeImage = async (input: StoreImageInput): Promise<StoredFile> => {
  const image = await checkImage(input.bytes);
  const id = await writeFile({
    admin: input.admin,
    brandId: input.brandId,
    userId: input.userId,
    kind: input.kind,
    extension: image.extension,
    contentType: image.contentType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
  });

  return {
    id,
    brandId: input.brandId,
    kind: input.kind,
    contentType: image.contentType,
    bytes: image.bytes.byteLength,
    width: image.width,
    height: image.height,
  };
};

export const CHART_KIND = "chart" as const;

const SHEET_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
} as const;

export type StoreChartFileInput = Readonly<{
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  bytes: Uint8Array;
}>;

export type StoredChartFile = Readonly<{ id: string; brandId: string; contentType: string; bytes: number }>;

/**
 * Stores a size chart file a brand sent. Its kind is judged from its bytes, never its
 * name, and a file that is neither a spreadsheet nor CSV text, or is over the limit, is
 * refused with a reason before anything is stored. The bytes are kept as they came: a
 * chart file is only ever read as text on the server, never shown or run.
 */
export const storeChartFile = async (input: StoreChartFileInput): Promise<StoredChartFile> => {
  const kind = sheetKind(input.bytes);
  if (!kind.ok) throw new AppError("invalid_input", kind.message);
  const contentType = SHEET_TYPES[kind.kind];
  const id = await writeFile({
    admin: input.admin,
    brandId: input.brandId,
    userId: input.userId,
    kind: CHART_KIND,
    extension: kind.kind,
    contentType,
    bytes: input.bytes,
    width: null,
    height: null,
  });
  return { id, brandId: input.brandId, contentType, bytes: input.bytes.byteLength };
};
