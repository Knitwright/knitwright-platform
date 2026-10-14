import { z } from "zod";
import { ASSET_COLOUR_SPACES } from "@/lib/artwork-stack";
import type { SourceFormat } from "./intake";

/** A row of `user_artworks`, as the database holds it. */
const rowSchema = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  kind: z.enum(["raster", "vector"]),
  source_format: z.enum(["png", "jpeg", "tiff", "pdf", "svg", "ai"]),
  label: z.string(),
  source_sha256: z.string(),
  print_sha256: z.string(),
  print_file_id: z.uuid().nullable(),
  vector_file_id: z.uuid().nullable(),
  screen_file_id: z.uuid(),
  width_px: z.number().int(),
  height_px: z.number().int(),
  dpi_meta: z.union([z.number(), z.string()]).nullable(),
  colour_space: z.enum(ASSET_COLOUR_SPACES),
  profile_name: z.string().nullable(),
  has_alpha: z.boolean(),
  rights_confirmed_by: z.uuid(),
  rights_confirmed_at: z.string(),
  rights_wording_version: z.string(),
  warnings: z.array(z.string()),
  created_at: z.string(),
});
export type ArtworkRow = z.infer<typeof rowSchema>;

/** What the app sees of one artwork. Hashes and rights are kept for records, not for screens. */
export type ArtworkRecord = Readonly<{
  id: string;
  brandId: string;
  kind: "raster" | "vector";
  sourceFormat: SourceFormat;
  label: string;
  widthPx: number;
  heightPx: number;
  dpiMeta: number | null;
  colourSpace: (typeof ASSET_COLOUR_SPACES)[number];
  profileName: string | null;
  hasAlpha: boolean;
  /** The small copy a browser may be given. */
  screenFileId: string;
  printFileId: string | null;
  vectorFileId: string | null;
  warnings: readonly string[];
  sourceSha256: string;
  printSha256: string;
  createdAt: string;
}>;

export const parseRow = (value: unknown): ArtworkRow => rowSchema.parse(value);

export const toRecord = (row: ArtworkRow): ArtworkRecord => ({
  id: row.id,
  brandId: row.brand_id,
  kind: row.kind,
  sourceFormat: row.source_format,
  label: row.label,
  widthPx: row.width_px,
  heightPx: row.height_px,
  dpiMeta: row.dpi_meta === null ? null : Number(row.dpi_meta),
  colourSpace: row.colour_space,
  profileName: row.profile_name,
  hasAlpha: row.has_alpha,
  screenFileId: row.screen_file_id,
  printFileId: row.print_file_id,
  vectorFileId: row.vector_file_id,
  warnings: row.warnings,
  sourceSha256: row.source_sha256,
  printSha256: row.print_sha256,
  createdAt: row.created_at,
});

export const COLUMNS =
  "id, brand_id, kind, source_format, label, source_sha256, print_sha256, print_file_id, vector_file_id, screen_file_id, width_px, height_px, dpi_meta, colour_space, profile_name, has_alpha, rights_confirmed_by, rights_confirmed_at, rights_wording_version, warnings, created_at";
