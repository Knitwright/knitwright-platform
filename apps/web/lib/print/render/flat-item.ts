import type { Affine } from "@/lib/print/geometry/affine";
import { pageSizeMm, type ImageItem, type PieceScene } from "@/lib/print/scene";
import { pageOrigin } from "./format";
import type { FlatArt } from "./types";

/** The flattened art as a single picture item that covers the whole page. */
export function flatArtItem(scene: PieceScene, art: FlatArt): ImageItem {
  const size = pageSizeMm(scene);
  const origin = pageOrigin(scene);
  const matrix: Affine = [size.width / art.widthPx, 0, 0, -size.height / art.heightPx, origin.x, origin.y];
  return { kind: "image", layerId: "flat", imageId: "flat", png: art.png, widthPx: art.widthPx, heightPx: art.heightPx, matrix, clip: [], opacity: 1, blend: "normal" };
}
