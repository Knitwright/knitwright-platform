import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ArtworkAsset, AssetReader } from "@/lib/artwork-stack";
import { COLUMNS, parseRow, toRecord } from "./records";
import { vectorModelSchema, type VectorModel } from "./vector/model";

const fileRow = z.object({ id: z.uuid(), bucket: z.enum(["uploads", "images", "exports"]), path: z.string() });

/** Reads one stored file's bytes by its id, within the brand. Null when there is no such file. */
const readFile = async (admin: SupabaseClient, brandId: string, fileId: string): Promise<Uint8Array | null> => {
  const { data, error } = await admin.from("files").select("id, bucket, path").eq("id", fileId).eq("brand_id", brandId).maybeSingle();
  if (error) throw new Error("The file's record could not be read.", { cause: error });
  if (!data) return null;
  const file = fileRow.parse(data);
  const download = await admin.storage.from(file.bucket).download(file.path);
  if (download.error || !download.data) throw new Error("The file could not be read.", { cause: download.error });
  return new Uint8Array(await download.data.arrayBuffer());
};

const missing = (what: string) => new Error(`The ${what} of this artwork is missing.`);

/**
 * The asset reader the artwork stack declares (lib/artwork-stack/assets.ts). It answers only for the brand it
 * was made for, so another brand's asset id is the same as no asset. A raster's print copy is an sRGB TIFF; a
 * vector's print copy is its vector model as JSON (see `readVectorModel`). Only the print files read the print copy.
 */
export const createAssetReader = (admin: SupabaseClient, brandId: string): AssetReader => ({
  getAsset: async (assetId): Promise<ArtworkAsset | null> => {
    if (!z.uuid().safeParse(assetId).success) return null;
    const { data, error } = await admin.from("user_artworks").select(COLUMNS).eq("id", assetId).eq("brand_id", brandId).maybeSingle();
    if (error) throw new Error("The artwork could not be read.", { cause: error });
    if (!data) return null;
    const record = toRecord(parseRow(data));
    const printId = record.printFileId ?? record.vectorFileId;
    return {
      id: record.id,
      kind: record.kind,
      widthPx: record.widthPx,
      heightPx: record.heightPx,
      dpiMeta: record.dpiMeta,
      colourSpace: record.colourSpace,
      hasAlpha: record.hasAlpha,
      readPrintCopy: async () => {
        const bytes = printId ? await readFile(admin, brandId, printId) : null;
        if (!bytes) throw missing("full size copy");
        return bytes;
      },
      readScreenCopy: async () => {
        const bytes = await readFile(admin, brandId, record.screenFileId);
        if (!bytes) throw missing("screen copy");
        return bytes;
      },
    };
  },
});

/** The vector model of a vector asset, checked against the schema. Null for a raster or an unknown asset. */
export const readVectorModel = async (reader: AssetReader, assetId: string): Promise<VectorModel | null> => {
  const asset = await reader.getAsset(assetId);
  if (!asset || asset.kind !== "vector") return null;
  return vectorModelSchema.parse(JSON.parse(new TextDecoder().decode(await asset.readPrintCopy())));
};
