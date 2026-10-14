import sharp from "sharp";
import type { ArtworkAsset, AssetReader } from "@/lib/artwork-stack";
import type { FileReader } from "@/lib/storage/read";
import { TOO_LARGE } from "@/lib/storage/read";

/** The largest older logo file read for printing, in bytes (the older upload path keeps files to 8 MB). */
export const LEGACY_MAX_BYTES = 8_000_000;

const SPACES: Readonly<Record<string, ArtworkAsset["colourSpace"]>> = { srgb: "srgb", cmyk: "cmyk", "b-w": "grey", grey16: "grey", rgb16: "srgb" };

/**
 * The asset reader for logos uploaded the older way (PNG, JPEG or WebP kept at screen size). It reads through the brand's own
 * file reader, so another brand's file is not found. The artwork intake (W7b) brings full-resolution copies and vectors; when
 * it lands, its reader is tried first and this one second. A picture read here warns about its resolution like any other.
 */
export function createLegacyAssetReader(reader: FileReader): AssetReader {
  return {
    async getAsset(assetId) {
      const stored = await reader.read(assetId, LEGACY_MAX_BYTES);
      if (stored === null || stored === TOO_LARGE) return null;
      const bytes = stored.bytes;
      try {
        const meta = await sharp(Buffer.from(bytes)).metadata();
        if (meta.width === undefined || meta.height === undefined) return null;
        return {
          id: assetId,
          kind: "raster",
          widthPx: meta.width,
          heightPx: meta.height,
          dpiMeta: meta.density ?? null,
          colourSpace: SPACES[meta.space ?? ""] ?? "unknown",
          hasAlpha: meta.hasAlpha === true,
          readPrintCopy: async () => bytes,
          readScreenCopy: async () => bytes,
        };
      } catch {
        return null;
      }
    },
  };
}

/** Tries each reader in turn and answers with the first that has the asset. */
export function composeAssetReaders(...readers: readonly AssetReader[]): AssetReader {
  return {
    async getAsset(assetId) {
      for (const reader of readers) {
        const found = await reader.getAsset(assetId);
        if (found !== null) return found;
      }
      return null;
    },
  };
}
