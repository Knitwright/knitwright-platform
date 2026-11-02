/**
 * The brand's own uploads, with the rights recorded on each one (plan v5, decision 0108; spec
 * Launch shell, "Uploads").
 *
 * `user_artworks` is where a brand's own pictures live, and every row of it carries three rights
 * columns and nothing more: who said it, when they said it, and the version of the words they saw.
 * `lib/artwork-intake/records.ts` deliberately drops those three on its way to a screen ("kept for
 * records, not for screens"), so this read asks for them itself rather than widening a shape five
 * other screens share.
 *
 * **Nothing is assumed.** The panel shows the record and the words that were on screen when the
 * file was uploaded. It never says a right has been established, because nothing in the platform
 * establishes one: that is `RIGHTS_GAP`, and it carries `R-GAP-000` because no rulebook entry says
 * what evidence a brand must keep.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { WORDINGS } from "@/lib/consent/wording";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { dayOf, type UploadRights, type UploadRow, type UploadsView } from "./view";

/** A brand's own picture list is short; `listArtworks` reads 200 and so does this. */
const READ_LIMIT = 200;

const COLUMNS =
  "id, kind, source_format, label, width_px, height_px, rights_confirmed_at, rights_wording_version";

const row = z.object({
  id: z.uuid(),
  kind: z.enum(["raster", "vector"]),
  source_format: z.enum(["png", "jpeg", "tiff", "pdf", "svg", "ai"]),
  label: z.string(),
  width_px: z.number().int(),
  height_px: z.number().int(),
  rights_confirmed_at: z.string(),
  rights_wording_version: z.string(),
});

type Row = z.infer<typeof row>;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/** A picture made of pixels, or a drawing. The two words a person would use, not the column's. */
const KIND_LABELS: Readonly<Record<Row["kind"], string>> = { raster: "Picture", vector: "Drawing" };

const FORMAT_LABELS: Readonly<Record<Row["source_format"], string>> = {
  png: "PNG",
  jpeg: "JPEG",
  tiff: "TIFF",
  pdf: "PDF",
  svg: "SVG",
  ai: "Illustrator",
};

/**
 * The words that were on screen when the file was uploaded, when this repository still holds that
 * version of them. A version it no longer holds answers null, and the row shows the version instead
 * of a sentence somebody might have changed since.
 */
export const wordingTextOf = (version: string): string | null => WORDINGS.find((wording) => wording.version === version)?.text ?? null;

export const rightsOf = (entry: Row): UploadRights => ({
  whenIso: entry.rights_confirmed_at,
  when: dayOf(entry.rights_confirmed_at),
  wordingVersion: entry.rights_wording_version,
  wordingText: wordingTextOf(entry.rights_wording_version),
});

export const uploadRowOf = (entry: Row, warnings: readonly string[]): UploadRow => ({
  id: entry.id,
  label: entry.label,
  kindLabel: KIND_LABELS[entry.kind],
  detail: `${FORMAT_LABELS[entry.source_format]}, ${entry.width_px} × ${entry.height_px} px`,
  rights: rightsOf(entry),
  warnings,
});

/**
 * One brand's uploads, newest first, read with the person's own client so the database's rules
 * decide as well as this code. The warnings a row recorded are read with it, because a picture that
 * sits on a white box is a thing the panel must say before it goes anywhere near a print file.
 */
export async function loadUploads(client: SupabaseClient, brandId: string): Promise<UploadsView> {
  const { data, error } = await client
    .from("user_artworks")
    .select(`${COLUMNS}, warnings`)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(row.extend({ warnings: z.array(z.string()).catch([]) })).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return { rows: parsed.data.map((entry) => uploadRowOf(entry, entry.warnings)), total: parsed.data.length };
}
