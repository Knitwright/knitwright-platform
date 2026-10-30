import { layerBox } from "./layers";
import { placements, type Area, type Placement } from "./tiling";
import type { RepeatDraft, RepeatLayer } from "./types";

/**
 * The repeat as something to draw: one tile's worth of draws, and where that tile is laid. The
 * panel maps over this and draws nothing it works out for itself, so what the preview shows and
 * what `tiling.ts` says are one answer.
 *
 * Where the tile joins at the edges, a layer that runs off one side is drawn again on the opposite
 * side, which is how a seamless repeat is made. With joining off, a layer is simply cut by the
 * tile's bounds.
 */

/** One draw of one layer inside the tile, by its top-left corner, in tenths of a millimetre. */
export type LayerDraw = Readonly<{
  layerId: string;
  /** `0` for the layer itself, and `1`, `2`, `3` for the copies that bring it back over an edge. */
  copy: number;
  leftTenths: number;
  topTenths: number;
  widthTenths: number;
  heightTenths: number;
  rotationDeg: number;
  colour: string;
  artworkId: string | null;
  shape: RepeatLayer["shape"];
  label: string;
}>;

const drawOf = (layer: RepeatLayer, copy: number, leftTenths: number, topTenths: number): LayerDraw => ({
  layerId: layer.id,
  copy,
  leftTenths,
  topTenths,
  widthTenths: layer.widthTenths,
  heightTenths: layer.heightTenths,
  rotationDeg: layer.rotationDeg,
  colour: layer.colour,
  artworkId: layer.artworkId,
  shape: layer.shape,
  label: layer.label,
});

/**
 * Every draw one layer needs. With joining on, a layer over the left edge is drawn again a tile to
 * the right, and the same up and down, which gives at most four draws in a corner.
 */
export function layerDraws(layer: RepeatLayer, draft: RepeatDraft): readonly LayerDraw[] {
  const box = layerBox(layer);
  const out = [drawOf(layer, 0, box.leftTenths, box.topTenths)];
  if (!draft.wrap) return out;
  const acrossBy = box.leftTenths < 0 ? draft.tile.widthTenths : box.rightTenths > draft.tile.widthTenths ? -draft.tile.widthTenths : 0;
  const downBy = box.topTenths < 0 ? draft.tile.heightTenths : box.bottomTenths > draft.tile.heightTenths ? -draft.tile.heightTenths : 0;
  if (acrossBy !== 0) out.push(drawOf(layer, 1, box.leftTenths + acrossBy, box.topTenths));
  if (downBy !== 0) out.push(drawOf(layer, 2, box.leftTenths, box.topTenths + downBy));
  if (acrossBy !== 0 && downBy !== 0) out.push(drawOf(layer, 3, box.leftTenths + acrossBy, box.topTenths + downBy));
  return out;
}

/** One tile's worth of draws, bottom layer first. */
export const tileDraws = (draft: RepeatDraft): readonly LayerDraw[] => draft.layers.flatMap((layer) => layerDraws(layer, draft));

export type RepeatPreview = Readonly<{
  background: string;
  tile: RepeatDraft["tile"];
  draws: readonly LayerDraw[];
  tiles: readonly Placement[];
  area: Area;
}>;

/** Everything the panel needs to draw the repeat across an area. */
export function repeatPreview(draft: RepeatDraft, area: Area): RepeatPreview {
  return { background: draft.background, tile: draft.tile, draws: tileDraws(draft), tiles: placements(draft.style, draft.tile, area), area };
}
