import type { ImageBytes, ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import type { FileReader, StoredBytes } from "@/lib/storage/read";

/**
 * The pictures a design's artwork uses, ready for a renderer: each read once, from
 * storage, shrunk for the screen, and keyed by file id. A picture that cannot be read
 * is left out, and the drawing then shows a dashed box where it goes. Nothing throws.
 */
export async function loadArtworkImages(
  reader: FileReader,
  shrink: (file: StoredBytes) => Promise<ImageBytes | null>,
  spec: GarmentSpec,
): Promise<ImageMap> {
  const ids = [...new Set(spec.artwork.flatMap((art) => (art.source.kind === "file" ? [art.source.fileId] : [])))];
  const found = await Promise.all(
    ids.map(async (id): Promise<readonly [string, ImageBytes] | null> => {
      try {
        const stored = await reader.read(id);
        const small = stored ? await shrink(stored) : null;
        return small ? [id, small] : null;
      } catch {
        return null;
      }
    }),
  );
  return new Map(found.flatMap((entry) => (entry ? [entry] : [])));
}
