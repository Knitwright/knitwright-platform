/**
 * Pictures given to a renderer. The caller has already fetched the bytes, so a renderer
 * never fetches anything. Only the two types the upload check produces are drawn.
 */
import { rotateAbout } from "./geometry";
import type { FlatImage, FlatPath, Point } from "./model";

export const DRAWABLE_TYPES = ["image/png", "image/jpeg"] as const;

export type DrawableType = (typeof DRAWABLE_TYPES)[number];

export interface ImageBytes {
  readonly bytes: Uint8Array;
  readonly contentType: DrawableType;
}

/** The bytes of each stored file, by file id. */
export type ImageMap = ReadonlyMap<string, ImageBytes>;

/** A dashed box that stands in for a picture whose bytes are not available. Both renderers draw this same path. */
export function missingImagePath(image: FlatImage): FlatPath {
  const { at, width, height, rotation } = image;
  const corners = [
    { x: at.x - width / 2, y: at.y - height / 2 },
    { x: at.x + width / 2, y: at.y - height / 2 },
    { x: at.x + width / 2, y: at.y + height / 2 },
    { x: at.x - width / 2, y: at.y + height / 2 },
  ].map((corner) => rotateAbout(corner, at, rotation));
  const [first, ...rest] = corners as [Point, ...Point[]];
  return {
    kind: "path",
    name: "Missing picture",
    panelId: null,
    commands: [{ op: "M", to: first }, ...rest.map((to) => ({ op: "L" as const, to })), { op: "Z" }],
    fill: null,
    stroke: { colour: "#9ca3af", width: 3, dash: [16, 10] },
  };
}

/** The bytes for a file when they are present and of a type that can be drawn, otherwise null. */
export function drawableImage(images: ImageMap, fileId: string): ImageBytes | null {
  const found = images.get(fileId);
  return found && DRAWABLE_TYPES.includes(found.contentType) && found.bytes.byteLength > 0 ? found : null;
}
