import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ArtworkAsset, AssetReader } from "@/lib/artwork-stack/assets";
import { artworkRowSchema, type ArtworkRow } from "./records";

/**
 * The artwork-stack's `AssetReader`, for the print files and the design reader. Every lookup names the
 * brand as well as the id: an asset of another brand, a missing one and an id that is not an id all give
 * the same answer, null. The files behind an asset are asked for the same way, so a row cannot be made to
 * point at another brand's file. The print copy is read on the server only; a browser is given the screen
 * copy through the download link route.
 */

const fileRow = z.object({ bucket: z.string(), path: z.string() });

async function readBrandFile(client: SupabaseClient, brandId: string, fileId: string): Promise<Uint8Array> {
  const { data, error } = await client.from("files").select("bucket, path").eq("id", fileId).eq("brand_id", brandId).maybeSingle();
  const file = fileRow.safeParse(data);
  if (error || !file.success) throw new Error("A file of this artwork could not be found.");
  const download = await client.storage.from(file.data.bucket).download(file.data.path);
  if (download.error || !download.data) throw new Error("A file of this artwork could not be read.");
  return new Uint8Array(await download.data.arrayBuffer());
}

const assetOf = (client: SupabaseClient, brandId: string, row: ArtworkRow): ArtworkAsset => ({
  id: row.id,
  kind: row.kind,
  widthPx: row.width_px,
  heightPx: row.height_px,
  dpiMeta: row.dpi_meta,
  colourSpace: row.colour_space,
  hasAlpha: row.has_alpha,
  readPrintCopy: () => readBrandFile(client, brandId, row.print_file_id),
  readScreenCopy: () => readBrandFile(client, brandId, row.screen_file_id),
});

export function createArtworkAssetReader(client: SupabaseClient, brandId: string): AssetReader {
  return {
    async getAsset(assetId) {
      if (!z.uuid().safeParse(assetId).success) return null;
      const { data, error } = await client.from("user_artworks").select("*").eq("id", assetId).eq("brand_id", brandId).maybeSingle();
      const row = artworkRowSchema.safeParse(data);
      if (error || !row.success || row.data.brand_id !== brandId) return null;
      return assetOf(client, brandId, row.data);
    },
  };
}
