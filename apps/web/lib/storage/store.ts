import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sheetKind } from "@/lib/charts/container";
import { AppError } from "@/lib/server/core/errors";
import { checkImage } from "./image";
import { privateMediaBytes } from "./private-usage";
import { isQuotaRefusal, STORAGE_FULL_MESSAGE, storageRoom } from "./quota";
import type { LogoRights } from "./rights";

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
const bucketFor = (kind: StoredKind | typeof CHART_KIND | ProductionKind): "uploads" | "images" =>
  kind === "render" ? "images" : "uploads";

type Bucket = "uploads" | "images" | "exports";

export type StoreImageInput = Readonly<{
  /** Full access. Used to write the file and its record. */
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  kind: StoredKind;
  bytes: Uint8Array;
  /** The type the browser stated. The content decides, so it is not used. */
  statedType: string;
  /** For artwork from a person: their confirmation that they may use it (lib/storage/rights.ts). */
  rights?: LogoRights | null;
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
  kind: StoredKind | typeof CHART_KIND | typeof PATTERN_KIND | ProductionKind;
  /** Where it goes when the kind alone does not say: a pattern's DXF and its picture differ. */
  bucket?: Bucket;
  extension: string;
  contentType: string;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
  rights?: LogoRights | null;
}>;

/**
 * Refuses, with the reason, when `incomingBytes` more would take the brand past its storage
 * quota. A courtesy before sending bytes to storage: the database keeps the rule itself, one
 * upload at a time per brand, when the file's record is written.
 */
export const ensureStorageRoom = async (admin: SupabaseClient, brandId: string, incomingBytes: number): Promise<void> => {
  const { data, error } = await admin.rpc("brand_storage_used", { p_brand_id: brandId });
  if (error) throw new Error("The brand's storage could not be measured.", { cause: error });
  // Clean pictures and videos have no `files` row, so the prefix is summed as well.
  const room = storageRoom(Number(data ?? 0) + (await privateMediaBytes(admin, brandId)), incomingBytes);
  if (!room.ok) throw new AppError("over_quota", room.message);
};

/** Writes checked bytes and their record. A file whose record fails is removed again. */
const writeFile = async (file: FileRecord): Promise<string> => {
  await ensureStorageRoom(file.admin, file.brandId, file.bytes.byteLength);
  const id = randomUUID();
  const path = `${file.brandId}/${file.kind}/${id}.${file.extension}`;
  const bucket = file.bucket ?? bucketFor(file.kind === PATTERN_KIND ? "render" : file.kind);
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
    ...(file.rights
      ? {
          rights_confirmed_by: file.rights.confirmedBy,
          rights_confirmed_at: file.rights.confirmedAt,
          rights_wording_version: file.rights.wordingVersion,
        }
      : {}),
  });
  if (record.error) {
    // A file with no record could never be found again. Remove it. If that fails too,
    // the record error is still the one to report, so the cleanup error is set aside.
    try {
      await files.remove([path]);
    } catch {
      // Nothing more can be done here.
    }
    if (isQuotaRefusal(record.error)) throw new AppError("over_quota", STORAGE_FULL_MESSAGE, undefined, { cause: record.error });
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
    rights: input.rights,
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

export const PATTERN_KIND = "pattern" as const;

/** The largest pattern file kept. A DXF of a full garment is tens of kilobytes. */
export const MAX_PATTERN_DXF_BYTES = 10 * 1024 * 1024;

/** A DXF file starts with a group code 0 and a SECTION, after any white space. */
const looksLikeDxf = (bytes: Uint8Array): boolean =>
  /^\s*0\s*\r?\n\s*SECTION\b/.test(new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 64)));

export type StorePatternInput = Readonly<{
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  dxf: Uint8Array;
  /** A picture of the pieces, when there is one. */
  preview: Uint8Array | null;
}>;

/**
 * Stores a drafted pattern: the DXF with the exports, checked to be one and kept as it came,
 * and its picture with the generated images, checked and rewritten like any picture. A DXF is
 * only ever downloaded, never shown or run. Returns the files' ids.
 */
export const storePatternFiles = async (input: StorePatternInput): Promise<{ dxf: string; preview: string | null }> => {
  if (input.dxf.byteLength === 0 || input.dxf.byteLength > MAX_PATTERN_DXF_BYTES || !looksLikeDxf(input.dxf)) {
    throw new AppError("invalid_input", "The pattern file is not a DXF file.");
  }
  const common = { admin: input.admin, brandId: input.brandId, userId: input.userId, kind: PATTERN_KIND, rights: null };
  const dxf = await writeFile({
    ...common,
    bucket: "exports",
    extension: "dxf",
    contentType: "application/dxf",
    bytes: input.dxf,
    width: null,
    height: null,
  });
  if (!input.preview) return { dxf, preview: null };
  const image = await checkImage(input.preview);
  const preview = await writeFile({
    ...common,
    bucket: "images",
    extension: image.extension,
    contentType: image.contentType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
  });
  return { dxf, preview };
};

/** The kinds of file the production outputs add (plans/production-outputs.md). */
export const PRODUCTION_KINDS = ["print", "proof", "roster", "pattern-source"] as const;

export type ProductionKind = (typeof PRODUCTION_KINDS)[number];

/** What each non-picture production kind may hold: its types with their extensions, and its size limit. */
const PRODUCTION_RULES: Readonly<
  Record<Exclude<ProductionKind, "proof">, { types: Readonly<Record<string, string>>; maxBytes: number }>
> = {
  print: {
    types: { "application/pdf": "pdf", "image/tiff": "tiff" },
    maxBytes: 40 * 1024 * 1024,
  },
  roster: { types: { "text/csv": "csv" }, maxBytes: 2 * 1024 * 1024 },
  "pattern-source": { types: { "application/dxf": "dxf" }, maxBytes: MAX_PATTERN_DXF_BYTES },
};

const startsWith = (bytes: Uint8Array, text: string): boolean =>
  text.split("").every((char, i) => bytes[i] === char.charCodeAt(0));

const TIFF_LITTLE = [0x49, 0x49, 0x2a, 0x00];
const TIFF_BIG = [0x4d, 0x4d, 0x00, 0x2a];

const isTiff = (bytes: Uint8Array): boolean =>
  [TIFF_LITTLE, TIFF_BIG].some((magic) => magic.every((byte, i) => bytes[i] === byte));

const isPlainText = (bytes: Uint8Array): boolean => {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

const LOOKS_RIGHT: Readonly<Record<string, (bytes: Uint8Array) => boolean>> = {
  "application/pdf": (bytes) => startsWith(bytes, "%PDF-"),
  "image/tiff": isTiff,
  "text/csv": isPlainText,
  "application/dxf": looksLikeDxf,
};

export type StoreProductionFileInput = Readonly<{
  admin: SupabaseClient;
  brandId: string;
  userId: string;
  bytes: Uint8Array;
  /** The type the server built the file as. Required except for a proof photo, which is judged by its content. */
  contentType?: string;
}>;

export type StoredProductionFile = Readonly<{
  id: string;
  brandId: string;
  kind: ProductionKind;
  contentType: string;
  bytes: number;
}>;

/**
 * Stores a production file: a print file, a proof photo, a roster or a source pattern. The bytes
 * must look like the type they are stored as, and the kind decides which types and sizes are
 * allowed, so a mistake in the caller cannot put a script or the wrong file in the bucket. A
 * proof photo is checked and rewritten like any picture.
 */
export const storeProductionFile = async (
  kind: ProductionKind,
  input: StoreProductionFileInput,
): Promise<StoredProductionFile> => {
  const common = { admin: input.admin, brandId: input.brandId, userId: input.userId, kind, width: null, height: null };
  if (kind === "proof") {
    const image = await checkImage(input.bytes);
    const id = await writeFile({ ...common, width: image.width, height: image.height, bucket: "uploads", extension: image.extension, contentType: image.contentType, bytes: image.bytes });
    return { id, brandId: input.brandId, kind, contentType: image.contentType, bytes: image.bytes.byteLength };
  }
  const rule = PRODUCTION_RULES[kind];
  const contentType = input.contentType ?? "";
  const extension = rule.types[contentType];
  if (!extension) throw new AppError("invalid_input", "This kind of file cannot be stored here.");
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > rule.maxBytes || !LOOKS_RIGHT[contentType](input.bytes)) {
    throw new AppError("invalid_input", "The file is empty, too large, or not the kind of file it says it is.");
  }
  const id = await writeFile({ ...common, bucket: "exports", extension, contentType, bytes: input.bytes });
  return { id, brandId: input.brandId, kind, contentType, bytes: input.bytes.byteLength };
};
