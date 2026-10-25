import type { SupabaseClient } from "@supabase/supabase-js";
import type { VideoFiles } from "./ports";

const BUCKET = "images";

/** Videos in storage with the server's key. A path outside this brand's private folder is never read or removed. */
export function videoFiles(admin: SupabaseClient, brandId: string): VideoFiles {
  const mine = (path: string): boolean => path.startsWith(`_private/${brandId}/`);
  return {
    async save(path, bytes, type) {
      if (!mine(path)) throw new Error("A video can only be kept in the brand's private folder.");
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
      if (error) throw new Error("The video could not be stored.", { cause: error });
    },
    async read(path) {
      if (!mine(path)) return null;
      const download = await admin.storage.from(BUCKET).download(path);
      return download.error || !download.data ? null : new Uint8Array(await download.data.arrayBuffer());
    },
    async remove(paths) {
      const own = paths.filter(mine);
      if (own.length > 0) await admin.storage.from(BUCKET).remove(own);
    },
  };
}
