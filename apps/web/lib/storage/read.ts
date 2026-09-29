import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Reading the bytes of a stored file on the server, to draw it. It uses the user's own
 * client, so the database's rules decide as well as this code, and it asks only for files
 * of the brand the user is working in. A file that is not there, is another brand's, or
 * cannot be read all give the same answer: nothing. A file over the size limit is not
 * downloaded at all, and that has an answer of its own so a screen can say why. Files
 * reach a browser through the download route and no other way.
 */

export interface StoredBytes {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export const TOO_LARGE = "too-large" as const;

export interface FileReader {
  /** The bytes, `TOO_LARGE` when the file is over `maxBytes`, or null when it cannot be read. */
  read(fileId: string, maxBytes: number): Promise<StoredBytes | typeof TOO_LARGE | null>;
}

const row = z.object({ bucket: z.string(), path: z.string(), content_type: z.string(), bytes: z.number() });

export function createFileReader(client: SupabaseClient, brandId: string): FileReader {
  return {
    async read(fileId, maxBytes) {
      if (!z.uuid().safeParse(fileId).success) return null;
      const { data, error } = await client
        .from("files")
        .select("bucket, path, content_type, bytes")
        .eq("id", fileId)
        .eq("brand_id", brandId)
        .maybeSingle();
      const parsed = row.safeParse(data);
      if (error || !parsed.success) return null;
      // The recorded size decides before anything is downloaded.
      if (parsed.data.bytes > maxBytes) return TOO_LARGE;
      const download = await client.storage.from(parsed.data.bucket).download(parsed.data.path);
      if (download.error || !download.data) return null;
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      return bytes.byteLength > maxBytes ? TOO_LARGE : { bytes, contentType: parsed.data.content_type };
    },
  };
}
