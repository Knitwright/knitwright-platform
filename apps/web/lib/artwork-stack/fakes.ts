import type { ArtworkAsset, AssetReader } from "./assets";
import type { ViewId } from "./anchors";
import type { PieceMapper } from "./piece-mapper";

/** A mapper that puts each view on one piece named after it and leaves the coordinates alone. For tests of code that needs a mapper. */
export function createFakePieceMapper(): PieceMapper {
  return { toPiece: (view: ViewId, point) => ({ pieceId: view, xMm: point.x, yMm: point.y }) };
}

/** An asset reader over a fixed list. For tests of code that needs the reader. */
export function createFakeAssetReader(assets: readonly Pick<ArtworkAsset, "id" | "kind" | "widthPx" | "heightPx">[]): AssetReader {
  return {
    getAsset: async (assetId) => {
      const found = assets.find((entry) => entry.id === assetId);
      if (found === undefined) return null;
      const copy = async (): Promise<Uint8Array> => new Uint8Array(0);
      return { ...found, dpiMeta: null, colourSpace: "srgb", hasAlpha: false, readPrintCopy: copy, readScreenCopy: copy };
    },
  };
}
