import type { ImageBytes, ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import { TOO_LARGE, type FileReader, type StoredBytes } from "@/lib/storage/read";

/** The most pictures drawn on one page. Artwork beyond this shows a dashed box. */
export const MAX_PICTURES_DRAWN = 8;
/** The most bytes read for one picture. A file whose recorded size is over this is not downloaded. */
export const MAX_PICTURE_BYTES = 3 * 1024 * 1024;
/** The most bytes of pictures put into one page, counted after they are shrunk. */
export const MAX_EMBEDDED_BYTES = 600 * 1024;
/** The most files read at the same time. */
export const MAX_READS_AT_ONCE = 3;

export interface LoadedPictures {
  readonly images: ImageMap;
  /** Pictures left out because they are too big or there are too many. Missing files are not counted. */
  readonly skipped: number;
}

type Outcome = { readonly kind: "picture"; readonly id: string; readonly image: ImageBytes } | { readonly kind: "too-big" } | { readonly kind: "gone" };

/** Runs the work on the items with at most `limit` running at once. The answers keep the order of the items. */
async function inBatches<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const answers: R[] = [];
  for (let start = 0; start < items.length; start += limit) {
    answers.push(...(await Promise.all(items.slice(start, start + limit).map(work))));
  }
  return answers;
}

/**
 * The pictures a design's artwork uses, ready for a renderer: read from storage, a few at
 * a time and within limits, shrunk for the screen, and keyed by file id. A picture that is
 * left out, or cannot be read, is drawn as a dashed box. Nothing throws.
 */
export async function loadArtworkImages(
  reader: FileReader,
  shrink: (file: StoredBytes) => Promise<ImageBytes | null>,
  spec: GarmentSpec,
): Promise<LoadedPictures> {
  const ids = [...new Set(spec.artwork.flatMap((art) => (art.source.kind === "file" ? [art.source.fileId] : [])))];
  const drawn = ids.slice(0, MAX_PICTURES_DRAWN);
  const outcomes = await inBatches(drawn, MAX_READS_AT_ONCE, async (id): Promise<Outcome> => {
    try {
      const stored = await reader.read(id, MAX_PICTURE_BYTES);
      if (stored === TOO_LARGE) return { kind: "too-big" };
      const image = stored ? await shrink(stored) : null;
      return image ? { kind: "picture", id, image } : { kind: "gone" };
    } catch {
      return { kind: "gone" };
    }
  });
  const images = new Map<string, ImageBytes>();
  let embedded = 0;
  let skipped = ids.length - drawn.length;
  for (const outcome of outcomes) {
    if (outcome.kind === "too-big") skipped += 1;
    else if (outcome.kind === "picture" && embedded + outcome.image.bytes.byteLength > MAX_EMBEDDED_BYTES) skipped += 1;
    else if (outcome.kind === "picture") {
      embedded += outcome.image.bytes.byteLength;
      images.set(outcome.id, outcome.image);
    }
  }
  return { images, skipped };
}

/** One plain sentence saying some pictures are not shown and why, or null when all are. */
export function picturesNote(skipped: number): string | null {
  if (skipped <= 0) return null;
  return skipped === 1
    ? "1 picture is not shown, because it is too big or there are too many, so a dashed box marks where it goes."
    : `${skipped} pictures are not shown, because they are too big or there are too many, so a dashed box marks where each one goes.`;
}
