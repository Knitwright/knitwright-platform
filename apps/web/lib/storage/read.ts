import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Reading the bytes of a stored file on the server, to draw it. It uses the user's own
 * client, so the database's rules decide as well as this code, and it asks only for files
 * of the brand the user is working in. A file that is not there, is another brand's, or
 * cannot be read all give the same answer: nothing. Files reach a browser through the
 * download route and no other way. These bytes never leave the server as a file.
 */

export interface StoredBytes {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface FileReader {
  read(fileId: string): Promise<StoredBytes | null>;
}

const row = z.object({ bucket: z.string(), path: z.string(), content_type: z.string() });

export function createFileReader(client: SupabaseClient, brandId: string): FileReader {
  return {
    async read(fileId) {
      if (!z.uuid().safeParse(fileId).success) return null;
      const { data, error } = await client
        .from("files")
        .select("bucket, path, content_type")
        .eq("id", fileId)
        .eq("brand_id", brandId)
        .maybeSingle();
      const parsed = row.safeParse(data);
      if (error || !parsed.success) return null;
      const download = await client.storage.from(parsed.data.bucket).download(parsed.data.path);
      if (download.error || !download.data) return null;
      return { bytes: new Uint8Array(await download.data.arrayBuffer()), contentType: parsed.data.content_type };
    },
  };
}
