import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ASSET_COLOUR_SPACES } from "@/lib/artwork-stack/assets";
import { AppError } from "@/lib/server/core/errors";

/** The `user_artworks` table: one row per uploaded artwork. Every lookup names the brand as well as the id. */

export const ARTWORK_NOT_FOUND = "That artwork does not exist.";

export const artworkRowSchema = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  kind: z.enum(["raster", "vector"]),
  source_format: z.enum(["png", "jpeg", "tiff", "pdf", "svg"]),
  name: z.string(),
  source_sha256: z.string(),
  print_sha256: z.string(),
  print_file_id: z.uuid(),
  screen_file_id: z.uuid(),
  width_px: z.number().int(),
  height_px: z.number().int(),
  dpi_meta: z.number().nullable(),
  natural_width_mm: z.number().nullable(),
  colour_space: z.enum(ASSET_COLOUR_SPACES),
  colour_profile_name: z.string().nullable(),
  has_alpha: z.boolean(),
  white_background: z.boolean(),
  warnings: z.array(z.string()),
  derived_from: z.uuid().nullable(),
  created_at: z.string(),
});
export type ArtworkRow = z.output<typeof artworkRowSchema>;

/** What a browser is told about an artwork. No hashes, no file paths. */
export type ArtworkSummary = Readonly<{
  id: string;
  name: string;
  kind: "raster" | "vector";
  sourceFormat: ArtworkRow["source_format"];
  widthPx: number;
  heightPx: number;
  dpiMeta: number | null;
  naturalWidthMm: number | null;
  colourSpace: ArtworkRow["colour_space"];
  colourProfileName: string | null;
  hasAlpha: boolean;
  whiteBackground: boolean;
  warnings: readonly string[];
  derivedFrom: string | null;
  /** The small copy, as a file id for the download link route. */
  screenFileId: string;
  createdAt: string;
}>;

export const summaryOf = (row: ArtworkRow): ArtworkSummary => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  sourceFormat: row.source_format,
  widthPx: row.width_px,
  heightPx: row.height_px,
  dpiMeta: row.dpi_meta,
  naturalWidthMm: row.natural_width_mm,
  colourSpace: row.colour_space,
  colourProfileName: row.colour_profile_name,
  hasAlpha: row.has_alpha,
  whiteBackground: row.white_background,
  warnings: row.warnings,
  derivedFrom: row.derived_from,
  screenFileId: row.screen_file_id,
  createdAt: row.created_at,
});

const parseRow = (data: unknown): ArtworkRow => {
  const parsed = artworkRowSchema.safeParse(data);
  if (!parsed.success) throw new Error("The database gave an unexpected answer for an artwork.");
  return parsed.data;
};

const MAX_LISTED = 200;

export async function listArtworks(client: SupabaseClient, brandId: string): Promise<readonly ArtworkSummary[]> {
  const { data, error } = await client.from("user_artworks").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(MAX_LISTED);
  if (error) throw new Error("The artworks could not be read.", { cause: error });
  return (data ?? []).map((row: unknown) => summaryOf(parseRow(row)));
}

/** The artwork of this brand, or a not-found answer that is the same for a missing id and another brand's. */
export async function getArtworkRow(client: SupabaseClient, brandId: string, artworkId: string): Promise<ArtworkRow> {
  const notFound = () => new AppError("not_found", ARTWORK_NOT_FOUND);
  if (!z.uuid().safeParse(artworkId).success) throw notFound();
  const { data, error } = await client.from("user_artworks").select("*").eq("id", artworkId).eq("brand_id", brandId).maybeSingle();
  if (error) throw new Error("The artwork could not be read.", { cause: error });
  if (!data) throw notFound();
  return parseRow(data);
}

export type NewArtworkRow = Omit<ArtworkRow, "id" | "created_at" | "brand_id"> &
  Readonly<{ rights_confirmed_by: string; rights_confirmed_at: string; rights_wording_version: string; created_by: string }>;

export async function insertArtworkRow(admin: SupabaseClient, brandId: string, row: NewArtworkRow): Promise<ArtworkRow> {
  const { data, error } = await admin.from("user_artworks").insert({ ...row, brand_id: brandId }).select("*").single();
  if (error) throw new Error("The artwork's record could not be written.", { cause: error });
  return parseRow(data);
}

export async function deleteArtworkRow(admin: SupabaseClient, brandId: string, artworkId: string): Promise<void> {
  const { error } = await admin.from("user_artworks").delete().eq("id", artworkId).eq("brand_id", brandId);
  if (error) throw new Error("The artwork could not be removed.", { cause: error });
}
