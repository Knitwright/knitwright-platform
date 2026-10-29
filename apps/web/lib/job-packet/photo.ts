import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkImage, IMAGE_LIMITS } from "@/lib/storage/image";
import type { Recorded, RecordInput } from "./service";

/**
 * A factory's photo. The bytes decide the type (PNG, JPEG or WebP; the browser's word is ignored), the file is
 * held to the upload size limit, and it is read as an image and written out again, so what is stored is pixels
 * only: no camera, place or time details. It is stored in the private uploads bucket under the packet's own
 * folder, which no member's brand folder can match, and then recorded. If recording fails the file is removed.
 */

export const PHOTO_BUCKET = "uploads";
export const PHOTO_MAX_BYTES = IMAGE_LIMITS.maxBytes;

/** Where a packet's photo is stored. The database checks a recorded key has this shape for its own packet. */
export const photoKey = (packetId: string, id: string, extension: "jpg" | "png"): string => `job-packets/${packetId}/${id}.${extension}`;

export interface PhotoDeps {
  readonly check: typeof checkImage;
  readonly upload: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  readonly remove: (key: string) => Promise<void>;
  readonly record: (input: RecordInput) => Promise<Recorded>;
  readonly newId?: () => string;
}

export async function keepPhoto(deps: PhotoDeps, input: Readonly<{ token: string; packetId: string; bytes: Uint8Array; note: string }>): Promise<Recorded> {
  const image = await deps.check(input.bytes);
  const key = photoKey(input.packetId, (deps.newId ?? randomUUID)(), image.extension);
  await deps.upload(key, image.bytes, image.contentType);
  try {
    return await deps.record({ token: input.token, kind: "photo", note: input.note, photoKey: key });
  } catch (error) {
    await deps.remove(key).catch(() => undefined);
    throw error;
  }
}

/** Storage calls for photos, with the server's key. Never overwrites a file. */
export const photoStorage = (admin: Pick<SupabaseClient, "storage">): Pick<PhotoDeps, "upload" | "remove"> & { read: (key: string) => Promise<Uint8Array> } => ({
  upload: async (key, bytes, contentType) => {
    const { error } = await admin.storage.from(PHOTO_BUCKET).upload(key, bytes, { contentType, upsert: false });
    if (error) throw new Error("The photo could not be stored.", { cause: error });
  },
  remove: async (key) => {
    await admin.storage.from(PHOTO_BUCKET).remove([key]);
  },
  read: async (key) => {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(key);
    if (error || !data) throw new Error("The photo could not be read.", { cause: error });
    return new Uint8Array(await data.arrayBuffer());
  },
});
