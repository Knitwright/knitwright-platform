import { DEFAULT_DATUM, resolveDatum, type ImageFillLayer } from "@/lib/artwork-stack";
import { applyAll, compose, rotation, scaling, translation, type Affine, type Pt } from "../../geometry/affine";
import { boundsOf } from "../../geometry/polygon";
import type { Box, ImageItem, PrintIssue } from "../../scene";
import { effectiveDpi } from "../../rules/checks";
import { PICTURE_REFUSED, preparePicture } from "../pictures";
import type { Built, LayerResult, LayerSpace } from "../types";
import { softPictureIssue } from "./graphic";

/** The most tiles one piece may hold. Over it the tile is too small to be worth printing as a repeat. */
export const TILE_BUDGET = 2500;
/** A picture that states no resolution is read as this many dots per inch. */
export const ASSUMED_DPI = 72;

const stop = (text: string): LayerResult => ({ built: [], knock: [], colours: [], dpis: [], issues: [{ severity: "stop", text }] });

function designBox(space: LayerSpace): Box {
  return boundsOf(applyAll(space.toDesign, space.visible));
}

/** Tiles of a picture in rows hung from the view's datum, every other row shifted by half a tile when asked. */
function tilePlacements(layer: ImageFillLayer, space: LayerSpace, tileW: number, tileH: number): Pt[] | null {
  const { anchors } = space.input;
  const datum = resolveDatum(DEFAULT_DATUM, anchors.underarm ?? anchors["underarm-a"]);
  const origin: Pt = [datum.x + layer.offsetMm.x, datum.y + layer.offsetMm.y];
  const turn = (layer.rotationDeg * Math.PI) / 180;
  const back = rotation(-turn);
  const box = designBox(space);
  const corners = applyAll(compose(back, translation(-origin[0], -origin[1])), [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]]);
  const local = boundsOf(corners);
  const rows = [Math.floor(local.minY / tileH) - 1, Math.ceil(local.maxY / tileH) + 1] as const;
  const out: Pt[] = [];
  for (let j = rows[0]; j <= rows[1]; j += 1) {
    const shift = layer.halfDrop && Math.abs(j) % 2 === 1 ? tileW / 2 : 0;
    for (let i = Math.floor((local.minX - shift) / tileW) - 1; i <= Math.ceil((local.maxX - shift) / tileW) + 1; i += 1) {
      if (out.length > TILE_BUDGET) return null;
      out.push([i * tileW - tileW / 2 + shift, j * tileH]);
    }
  }
  return out;
}

const pixelMatrix = (space: LayerSpace, turn: number, origin: Pt, at: Pt, sx: number, sy: number): Affine =>
  compose(space.toPiece, compose(translation(origin[0], origin[1]), compose(rotation(turn), compose(translation(at[0], at[1]), scaling(sx, sy)))));

/** A picture that fills a piece: a repeat tile hung from the datum, or one panel fitted to the piece. */
export async function imageFillLayer(layer: ImageFillLayer, space: LayerSpace): Promise<LayerResult> {
  const { input } = space;
  const asset = await input.assets.getAsset(layer.assetId);
  if (!asset || asset.kind !== "raster") return stop(`The picture for layer ${layer.id} is not available, so it was left off.`);
  const own = asset.dpiMeta ?? ASSUMED_DPI;
  const naturalW = (asset.widthPx / own) * 25.4;
  const issues: PrintIssue[] = asset.dpiMeta === null ? [{ severity: "note", text: `The picture states no resolution, so ${ASSUMED_DPI} dpi was assumed to work out its size.` }] : [];
  const panel = layer.mode === "panel";
  const box = designBox(space);
  const fit = panel
    ? (layer.fit === "cover" ? Math.max : Math.min)((box.maxX - box.minX) / asset.widthPx, (box.maxY - box.minY) / asset.heightPx) * layer.scale
    : (naturalW / asset.widthPx) * layer.scale;
  const printedW = fit * asset.widthPx;
  const picture = await preparePicture(await asset.readPrintCopy(), printedW, input.settings.dpi);
  if (!picture) return stop(PICTURE_REFUSED);
  const dpi = effectiveDpi(picture.sourceWidthPx, printedW);
  const soft = softPictureIssue(dpi, space, picture.sourceWidthPx);
  if (soft) issues.push(soft);
  const sx = printedW / picture.widthPx;
  const sy = (fit * asset.heightPx) / picture.heightPx;
  const turn = (layer.rotationDeg * Math.PI) / 180;
  const make = (matrix: Affine): Built => ({
    kind: "image-fill",
    item: { kind: "image", layerId: layer.id, imageId: picture.imageId, png: picture.png, widthPx: picture.widthPx, heightPx: picture.heightPx, matrix, clip: [space.visible], opacity: layer.opacity, blend: layer.blend } satisfies ImageItem,
  });
  if (panel) {
    const centre: Pt = [(box.minX + box.maxX) / 2 + layer.offsetMm.x, (box.minY + box.maxY) / 2 + layer.offsetMm.y];
    const at: Pt = [-(printedW / 2), -((fit * asset.heightPx) / 2)];
    return { built: [make(pixelMatrix(space, turn, centre, at, sx, sy))], knock: [], issues, colours: [], dpis: [dpi] };
  }
  const tiles = tilePlacements(layer, space, printedW, fit * asset.heightPx);
  if (!tiles) return stop(`The repeat on layer ${layer.id} is so small that it would need more than ${TILE_BUDGET} tiles on one piece, so it was left off. Make the repeat larger.`);
  const datum = resolveDatum(DEFAULT_DATUM, input.anchors.underarm ?? input.anchors["underarm-a"]);
  const origin: Pt = [datum.x + layer.offsetMm.x, datum.y + layer.offsetMm.y];
  return { built: tiles.map((at) => make(pixelMatrix(space, turn, origin, at, sx, sy))), knock: [], issues, colours: [], dpis: [dpi] };
}
