import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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
const bucketFor = (kind: StoredKind): "uploads" | "images" => (kind === "render" ? "images" : "uploads");

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

export const storeImage = async (input: StoreImageInput): Promise<StoredFile> => {
  const image = await checkImage(input.bytes);
  const id = randomUUID();
  const path = `${input.brandId}/${input.kind}/${id}.${image.extension}`;
  const bucket = bucketFor(input.kind);
  const files = input.admin.storage.from(bucket);

  const upload = await files.upload(path, image.bytes, {
    contentType: image.contentType,
    upsert: false,
  });
  if (upload.error) throw new Error("The file could not be stored.", { cause: upload.error });

  const record = await input.admin.from("files").insert({
    id,
    brand_id: input.brandId,
    bucket,
    path,
    kind: input.kind,
    content_type: image.contentType,
    bytes: image.bytes.byteLength,
    width: image.width,
    height: image.height,
    created_by: input.userId,
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
