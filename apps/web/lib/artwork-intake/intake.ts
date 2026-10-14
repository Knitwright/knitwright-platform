import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import type { LogoRights } from "@/lib/storage/rights";
import { withConversionSlot } from "./gate";
import { ARTWORK_LIMITS } from "./limits";
import { ingestRaster, TOO_MANY_BYTES } from "./raster";
import { insertArtworkRow, summaryOf, type ArtworkSummary, deleteArtworkRow } from "./records";
import { NOT_ACCEPTED, sniffArtwork } from "./sniff";
import { removeArtworkFiles, writeArtworkFile, type StoredArtworkFile } from "./store";
import { intakeVector } from "./vector";

/**
 * Takes an uploaded file and turns it into stored artwork: its type from its first bytes, a picture read
 * as pixels and rewritten, a vector reduced to restricted JSON. The upload itself is never kept, so
 * nothing in it can run. A failure at any step removes whatever was already written.
 */

export type IntakeWho = Readonly<{ admin: SupabaseClient; brandId: string; userId: string; rights: LogoRights }>;

export type IntakeInput = Readonly<{
  bytes: Uint8Array;
  /** Shown to the person as the artwork's name. Never used as a path. */
  filename?: string;
  /** The artwork this one was made from, when it was made by remove-white or make-seamless. */
  derivedFrom?: string;
}>;

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** A name for the person to recognise the artwork by: the file's name without a folder or extension. */
export function displayName(filename: string | undefined): string {
  const base = (filename ?? "").split(/[\\/]/).pop() ?? "";
  const stem = base.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const clean = [...stem].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).join("").replace(/\s+/g, " ").trim();
  return clean.slice(0, 80) || "Artwork";
}

type Prepared = Readonly<{
  kind: "raster" | "vector";
  screen: Readonly<{ bytes: Uint8Array; contentType: "image/png" | "image/jpeg" }>;
  print: Readonly<{ kind: "artwork-print" | "artwork-vector"; contentType: "image/tiff" | "application/json"; bytes: Uint8Array }>;
  widthPx: number;
  heightPx: number;
  dpiMeta: number | null;
  naturalWidthMm: number | null;
  colourSpace: "srgb" | "cmyk" | "grey" | "adobe-rgb" | "display-p3" | "unknown";
  colourProfileName: string | null;
  hasAlpha: boolean;
  whiteBackground: boolean;
  warnings: readonly string[];
}>;

async function prepare(bytes: Uint8Array, format: "png" | "jpeg" | "tiff" | "pdf" | "svg"): Promise<Prepared> {
  if (format === "pdf" || format === "svg") {
    const vector = await intakeVector(bytes, format);
    return {
      kind: "vector",
      screen: { bytes: vector.preview, contentType: "image/png" },
      print: { kind: "artwork-vector", contentType: "application/json", bytes: vector.json },
      widthPx: vector.widthPx,
      heightPx: vector.heightPx,
      dpiMeta: null,
      naturalWidthMm: vector.doc.naturalWidthMm,
      colourSpace: "srgb",
      colourProfileName: null,
      hasAlpha: true,
      whiteBackground: false,
      warnings: vector.warnings,
    };
  }
  const raster = await ingestRaster(bytes, format);
  return {
    kind: "raster",
    screen: { bytes: raster.screen, contentType: raster.screenType },
    print: { kind: "artwork-print", contentType: "image/tiff", bytes: raster.print },
    widthPx: raster.widthPx,
    heightPx: raster.heightPx,
    dpiMeta: raster.dpiMeta,
    naturalWidthMm: null,
    colourSpace: raster.colourSpace,
    colourProfileName: raster.profileName,
    hasAlpha: raster.hasAlpha,
    whiteBackground: raster.whiteBackground,
    warnings: raster.warnings,
  };
}

export async function intakeArtwork(who: IntakeWho, input: IntakeInput): Promise<ArtworkSummary> {
  const { bytes } = input;
  if (bytes.byteLength === 0) throw new AppError("invalid_input", NOT_ACCEPTED);
  if (bytes.byteLength > ARTWORK_LIMITS.maxBytes) throw new AppError("too_large", TOO_MANY_BYTES);
  const sniffed = sniffArtwork(bytes);
  if (!sniffed.ok) throw new AppError("invalid_input", sniffed.message);

  return withConversionSlot(who.brandId, async () => {
    const prepared = await prepare(bytes, sniffed.format);
    const written: StoredArtworkFile[] = [];
    const common = { admin: who.admin, brandId: who.brandId, userId: who.userId, rights: who.rights };
    try {
      const screen = await writeArtworkFile({ ...common, kind: "artwork", contentType: prepared.screen.contentType, bytes: prepared.screen.bytes, width: null, height: null });
      written.push(screen);
      const print = await writeArtworkFile({
        ...common,
        kind: prepared.print.kind,
        contentType: prepared.print.contentType,
        bytes: prepared.print.bytes,
        width: prepared.kind === "raster" ? prepared.widthPx : null,
        height: prepared.kind === "raster" ? prepared.heightPx : null,
      });
      written.push(print);
      const row = await insertArtworkRow(who.admin, who.brandId, {
        kind: prepared.kind,
        source_format: sniffed.format,
        name: displayName(input.filename),
        source_sha256: sha256(bytes),
        print_sha256: sha256(prepared.print.bytes),
        print_file_id: print.id,
        screen_file_id: screen.id,
        width_px: prepared.widthPx,
        height_px: prepared.heightPx,
        dpi_meta: prepared.dpiMeta,
        natural_width_mm: prepared.naturalWidthMm,
        colour_space: prepared.colourSpace,
        colour_profile_name: prepared.colourProfileName,
        has_alpha: prepared.hasAlpha,
        white_background: prepared.whiteBackground,
        warnings: [...prepared.warnings],
        derived_from: input.derivedFrom ?? null,
        rights_confirmed_by: who.rights.confirmedBy,
        rights_confirmed_at: who.rights.confirmedAt,
        rights_wording_version: who.rights.wordingVersion,
        created_by: who.userId,
      });
      return summaryOf(row);
    } catch (error) {
      await removeArtworkFiles(who.admin, who.brandId, written);
      throw error;
    }
  });
}

/** Removes an artwork, its files and their records. */
export async function removeArtwork(
  admin: SupabaseClient,
  brandId: string,
  artwork: Readonly<{ id: string; print_file_id: string; screen_file_id: string }>,
): Promise<void> {
  const { data } = await admin.from("files").select("id, bucket, path").eq("brand_id", brandId).in("id", [artwork.print_file_id, artwork.screen_file_id]);
  await deleteArtworkRow(admin, brandId, artwork.id);
  await removeArtworkFiles(admin, brandId, (data ?? []) as StoredArtworkFile[]);
}
