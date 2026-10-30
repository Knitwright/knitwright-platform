import { COLOUR_PATTERN, type DrawnShape, type RepeatDraft, type RepeatLayer, type TileSize } from "./types";
import { tileInRange } from "./units";

/**
 * The tile's layers and its bounds: adding, moving, reordering and removing one, and saying what
 * crosses the tile's edge. Plain functions over a draft, so the panel holds no rules of its own
 * and every rule has a test.
 */

/** The box a layer fills inside the tile, in tenths of a millimetre from the tile's top-left corner. */
export type LayerBox = Readonly<{ leftTenths: number; topTenths: number; rightTenths: number; bottomTenths: number }>;

/** A layer is placed by its centre, so its box is half its size either side. */
export function layerBox(layer: RepeatLayer): LayerBox {
  const halfWidth = layer.widthTenths / 2;
  const halfHeight = layer.heightTenths / 2;
  return {
    leftTenths: layer.xTenths - halfWidth,
    topTenths: layer.yTenths - halfHeight,
    rightTenths: layer.xTenths + halfWidth,
    bottomTenths: layer.yTenths + halfHeight,
  };
}

/** True when the layer sits wholly inside the tile's bounds. */
export function withinTile(layer: RepeatLayer, tile: TileSize): boolean {
  const box = layerBox(layer);
  return box.leftTenths >= 0 && box.topTenths >= 0 && box.rightTenths <= tile.widthTenths && box.bottomTenths <= tile.heightTenths;
}

/** The layer moved the shortest way that puts it wholly inside the tile. A layer larger than the tile is centred. */
export function clampToTile(layer: RepeatLayer, tile: TileSize): RepeatLayer {
  const place = (centre: number, size: number, bound: number): number => {
    if (size >= bound) return Math.round(bound / 2);
    const half = size / 2;
    return Math.round(Math.min(Math.max(centre, half), bound - half));
  };
  return {
    ...layer,
    xTenths: place(layer.xTenths, layer.widthTenths, tile.widthTenths),
    yTenths: place(layer.yTenths, layer.heightTenths, tile.heightTenths),
  };
}

/** The ids of the layers that cross the tile's bounds, in the order they are listed. */
export const crossingBounds = (draft: RepeatDraft): readonly string[] =>
  draft.layers.filter((layer) => !withinTile(layer, draft.tile)).map((layer) => layer.id);

const replaceLayers = (draft: RepeatDraft, layers: readonly RepeatLayer[]): RepeatDraft => ({ ...draft, layers });

/** Adds a layer on top of the ones already there. */
export const addLayer = (draft: RepeatDraft, layer: RepeatLayer): RepeatDraft => replaceLayers(draft, [...draft.layers, layer]);

/** Takes a layer out. An id that is not there changes nothing. */
export const removeLayer = (draft: RepeatDraft, id: string): RepeatDraft =>
  replaceLayers(
    draft,
    draft.layers.filter((layer) => layer.id !== id),
  );

/** Changes one layer. An id that is not there changes nothing. */
export const changeLayer = (draft: RepeatDraft, id: string, change: Partial<RepeatLayer>): RepeatDraft =>
  replaceLayers(
    draft,
    draft.layers.map((layer) => (layer.id === id ? { ...layer, ...change, id: layer.id } : layer)),
  );

/**
 * Moves a layer one place towards the front (`1`) or the back (`-1`). A layer already at the end
 * it is moved towards stays where it is, so the buttons never reorder anything by surprise.
 */
export function reorderLayer(draft: RepeatDraft, id: string, towards: 1 | -1): RepeatDraft {
  const at = draft.layers.findIndex((layer) => layer.id === id);
  const to = at + towards;
  if (at < 0 || to < 0 || to >= draft.layers.length) return draft;
  const layers = [...draft.layers];
  const moved = layers[at] as RepeatLayer;
  layers[at] = layers[to] as RepeatLayer;
  layers[to] = moved;
  return replaceLayers(draft, layers);
}

/** The colour behind every layer. A colour that is not `#rrggbb` is refused, so nothing half-typed is kept. */
export const setBackground = (draft: RepeatDraft, colour: string): RepeatDraft => {
  const lower = colour.trim().toLowerCase();
  return COLOUR_PATTERN.test(lower) ? { ...draft, background: lower } : draft;
};

/** A side of the tile. A size outside the range is refused: the field says so instead. */
export const setTileSide = (draft: RepeatDraft, side: "width" | "height", tenths: number): RepeatDraft => {
  if (!tileInRange(tenths)) return draft;
  const tile = side === "width" ? { ...draft.tile, widthTenths: tenths } : { ...draft.tile, heightTenths: tenths };
  return { ...draft, tile };
};

/** What a new layer starts as: half the tile wide, in the middle of it, upright. */
export function newLayer(
  draft: RepeatDraft,
  input: Readonly<{ id: string; label: string; artworkId?: string | null; shape?: DrawnShape | null; colour?: string; sourcePx?: RepeatLayer["sourcePx"] }>,
): RepeatLayer {
  const widthTenths = Math.round(draft.tile.widthTenths / 2);
  const heightTenths = Math.round(draft.tile.heightTenths / 2);
  return {
    id: input.id,
    label: input.label,
    artworkId: input.artworkId ?? null,
    shape: input.shape ?? null,
    colour: input.colour ?? "#1b2a49",
    xTenths: Math.round(draft.tile.widthTenths / 2),
    yTenths: Math.round(draft.tile.heightTenths / 2),
    widthTenths,
    heightTenths,
    rotationDeg: 0,
    sourcePx: input.sourcePx ?? null,
  };
}
