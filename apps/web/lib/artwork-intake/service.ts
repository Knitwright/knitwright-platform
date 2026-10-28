import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { AppError } from "@/lib/server/core/errors";
import { applySeamless, checkTile, removeWhite, seamlessPreview, type SeamlessPreview } from "./convert";
import { intakeArtwork, intakeFromRaster } from "./intake";
import { REFUSALS } from "./messages";
import { createAssetReader } from "./reader";
import { COLUMNS, parseRow, toRecord, type ArtworkRecord, type ArtworkRow } from "./records";
import { hasWhiteBackground } from "./raster/white";
import { withSlot } from "./slots";
import { discard, rightsFor, storeArtwork } from "./store";
import type { SeamReport, SeamlessMethod } from "./tile";
import { dpiWarning } from "./dpi";

export type Actor = Readonly<{ brandId: string; userId: string }>;

const notFound = () => new AppError("not_found", REFUSALS.noSuchArtwork);

/** Takes in an upload and stores it. Nothing is stored unless the whole file is accepted. */
export const uploadArtwork = async (
  admin: SupabaseClient,
  actor: Actor,
  input: Readonly<{ bytes: Uint8Array; fileName: string; rightsConfirmed: boolean; now: Date }>,
): Promise<ArtworkRecord & { whiteBackground: boolean }> => {
  // Rights are asked for before any file is read.
  const rights = rightsFor({ confirmed: input.rightsConfirmed, userId: actor.userId, now: input.now });
  return withSlot(actor.brandId, async () => {
    const intake = await intakeArtwork(input.bytes, input.fileName);
    const record = await storeArtwork({ admin, brandId: actor.brandId, userId: actor.userId, intake, rights });
    return { ...record, whiteBackground: intake.whiteBackground };
  });
};

/** The brand's artwork, newest first. Read with the person's own client, so the database's rules apply as well. */
export const listArtworks = async (client: SupabaseClient, brandId: string): Promise<ArtworkRecord[]> => {
  const { data, error } = await client.from("user_artworks").select(COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("The artwork could not be listed.", { cause: error });
  return (data ?? []).map((row) => toRecord(parseRow(row)));
};

const rowOf = async (admin: SupabaseClient, brandId: string, id: string): Promise<ArtworkRow> => {
  const { data, error } = await admin.from("user_artworks").select(COLUMNS).eq("id", id).eq("brand_id", brandId).maybeSingle();
  if (error) throw new Error("The artwork could not be read.", { cause: error });
  if (!data) throw notFound();
  return parseRow(data);
};

export type ArtworkDetail = Readonly<{
  artwork: ArtworkRecord;
  /** The picture has an opaque white border, so "Remove the white background" is offered. */
  canRemoveWhiteBackground: boolean;
  /** The plain warning for the width asked about, or null. */
  dpiWarning: string | null;
  /** The resolution at that width, to the nearest dpi. Null for a vector, which never warns. */
  effectiveDpi: number | null;
}>;

/** One artwork, with the dpi check for a printed width when one is given. */
export const getArtworkDetail = async (
  admin: SupabaseClient,
  brandId: string,
  id: string,
  question: Readonly<{ widthMm?: number; minDpi?: number }> = {},
): Promise<ArtworkDetail> => {
  const artwork = toRecord(await rowOf(admin, brandId, id));
  const reader = createAssetReader(admin, brandId);
  const asset = await reader.getAsset(id);
  if (!asset) throw notFound();
  const screen = artwork.kind === "raster" ? await asset.readScreenCopy() : null;
  let canRemove = false;
  if (screen) {
    const { data, info } = await sharp(screen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    canRemove = hasWhiteBackground({ data, width: info.width, height: info.height, channels: 4 });
  }
  const widthMm = question.widthMm;
  const warning = widthMm === undefined ? null : dpiWarning(artwork, widthMm, question.minDpi);
  const dpi = widthMm !== undefined && artwork.kind === "raster" ? Math.round(artwork.widthPx / (widthMm / 25.4)) : null;
  return { artwork, canRemoveWhiteBackground: canRemove, dpiWarning: warning, effectiveDpi: dpi };
};

/** Removes an artwork and all its files. A design that still uses it will find no asset and say so. */
export const deleteArtwork = async (admin: SupabaseClient, brandId: string, id: string): Promise<void> => {
  const row = await rowOf(admin, brandId, id);
  const ids = [row.screen_file_id, row.print_file_id, row.vector_file_id].filter((value): value is string => value !== null);
  const files = await admin.from("files").select("id, bucket, path").in("id", ids).eq("brand_id", brandId);
  if (files.error) throw new Error("The artwork's files could not be found.", { cause: files.error });
  await discard(
    admin,
    brandId,
    (files.data ?? []).map((file: { id: string; bucket: "uploads" | "exports"; path: string }) => ({ id: file.id, bucket: file.bucket, path: file.path })),
  );
};

const printOf = async (admin: SupabaseClient, brandId: string, id: string) => {
  const row = await rowOf(admin, brandId, id);
  if (row.kind !== "raster") throw new AppError("invalid_input", REFUSALS.notATile);
  const asset = await createAssetReader(admin, brandId).getAsset(id);
  if (!asset) throw notFound();
  return { row, print: await asset.readPrintCopy() };
};

/** The seam check of a stored picture, as a tile. */
export const checkArtworkTile = (admin: SupabaseClient, actor: Actor, id: string): Promise<SeamReport> =>
  withSlot(actor.brandId, async () => checkTile((await printOf(admin, actor.brandId, id)).print));

export type Change =
  | Readonly<{ action: "remove-white-background" }>
  | Readonly<{ action: "make-seamless"; method: SeamlessMethod }>;

export type ChangeResult =
  | Readonly<{ accepted: false; summary: ChangeSummary }>
  | Readonly<{ accepted: true; artwork: ArtworkRecord }>;

export type ChangeSummary = Readonly<{
  action: Change["action"];
  /** The method shown, so accepting applies exactly what was previewed. */
  method?: SeamlessMethod;
  /** A PNG as a data address, for the person to look at. */
  previewPng: string;
  before?: SeamReport;
  after?: SeamReport;
  limit?: string;
}>;

const dataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString("base64")}`;

const inherit = (row: ArtworkRow) => ({ confirmedBy: row.rights_confirmed_by, confirmedAt: row.rights_confirmed_at, wordingVersion: row.rights_wording_version });

const storeChange = async (
  admin: SupabaseClient,
  actor: Actor,
  row: ArtworkRow,
  raster: Awaited<ReturnType<typeof removeWhite>>,
  suffix: string,
): Promise<ArtworkRecord> => {
  const intake = intakeFromRaster(raster, { sourceFormat: "png", label: `${row.label} (${suffix})`.slice(0, 80), sourceSha256: row.source_sha256 });
  return storeArtwork({ admin, brandId: actor.brandId, userId: actor.userId, intake, rights: inherit(row) });
};

/**
 * Changes a picture. Without `accept` it only shows what would happen (nothing is stored); with `accept` the
 * changed picture is stored as a new artwork and the original stays. The new artwork keeps the original's rights confirmation.
 */
export const changeArtwork = (
  admin: SupabaseClient,
  actor: Actor,
  id: string,
  change: Change,
  accept: boolean,
): Promise<ChangeResult> =>
  withSlot(actor.brandId, async () => {
    const { row, print } = await printOf(admin, actor.brandId, id);
    const dpi = row.dpi_meta === null ? null : Number(row.dpi_meta);
    if (change.action === "remove-white-background") {
      const raster = await removeWhite(print, dpi);
      if (accept) return { accepted: true, artwork: await storeChange(admin, actor, row, raster, "no white box") };
      return { accepted: false, summary: { action: change.action, previewPng: dataUrl(raster.screen.contentType === "image/png" ? raster.screen.bytes : await sharp(raster.screen.bytes).png().toBuffer()) } };
    }
    const preview: SeamlessPreview = await seamlessPreview(print, change.method);
    if (accept) return { accepted: true, artwork: await storeChange(admin, actor, row, await applySeamless(preview, dpi), "seamless") };
    return {
      accepted: false,
      summary: { action: change.action, method: change.method, previewPng: dataUrl(preview.preview), before: preview.before, after: preview.after, limit: preview.limit },
    };
  });
