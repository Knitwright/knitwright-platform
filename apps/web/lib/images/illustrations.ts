import sharp from "sharp";
import type { View } from "@/lib/flat/model";
import { TOO_LARGE, type FileReader } from "@/lib/storage/read";
import { MAX_INPUT_PIXELS } from "@/lib/storage/thumbnail";
import type { LatestImages } from "./service";

/**
 * The newest photoreal pictures of a design, made small for a page. They are shown as
 * data addresses, like the flats, so no link to storage reaches the browser. Plan step 14,
 * task 5: every one is described as an illustration.
 */

/** Longest side on the page, in pixels. */
export const ILLUSTRATION_EDGE = 640;

/** A stored generated picture is at most this large. */
const MAX_READ_BYTES = 10 * 1024 * 1024;

const LABELS: Readonly<Record<View, string>> = { front: "Front", back: "Back" };

export interface Illustration {
  readonly view: View;
  readonly label: string;
  readonly src: string;
  readonly alt: string;
}

export interface LoadedIllustrations {
  readonly version: number;
  readonly illustrations: readonly Illustration[];
}

const shrink = async (bytes: Uint8Array): Promise<string | null> => {
  try {
    const small = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({ width: ILLUSTRATION_EDGE, height: ILLUSTRATION_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${small.toString("base64")}`;
  } catch {
    return null;
  }
};

const one = async (reader: FileReader, view: View, fileId: string): Promise<Illustration | null> => {
  const stored = await reader.read(fileId, MAX_READ_BYTES).catch(() => null);
  if (!stored || stored === TOO_LARGE) return null;
  const src = await shrink(stored.bytes);
  const label = LABELS[view];
  return src ? { view, label, src, alt: `AI illustration of the ${view} of the garment. Not a specification.` } : null;
};

/** Null when there is nothing to show. A picture that cannot be read is left out. */
export async function loadIllustrations(
  reader: FileReader,
  latest: LatestImages | null,
): Promise<LoadedIllustrations | null> {
  if (!latest) return null;
  const found = await Promise.all(latest.images.map((image) => one(reader, image.view, image.fileId)));
  const illustrations = found.filter((item): item is Illustration => item !== null);
  return illustrations.length > 0 ? { version: latest.version, illustrations } : null;
}
