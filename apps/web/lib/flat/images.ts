/**
 * Pictures given to a renderer. The caller has already fetched the bytes, so a renderer
 * never fetches anything. Only the two types the upload check produces are drawn.
 */
export const DRAWABLE_TYPES = ["image/png", "image/jpeg"] as const;

export type DrawableType = (typeof DRAWABLE_TYPES)[number];

export interface ImageBytes {
  readonly bytes: Uint8Array;
  readonly contentType: DrawableType;
}

/** The bytes of each stored file, by file id. */
export type ImageMap = ReadonlyMap<string, ImageBytes>;

/** The bytes for a file when they are present and of a type that can be drawn, otherwise null. */
export function drawableImage(images: ImageMap, fileId: string): ImageBytes | null {
  const found = images.get(fileId);
  return found && DRAWABLE_TYPES.includes(found.contentType) && found.bytes.byteLength > 0 ? found : null;
}
