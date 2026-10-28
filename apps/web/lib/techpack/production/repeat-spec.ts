import { colourWords, findGenerator, kitGeneratorId, resolveColour, type ArtworkStack, type ImageFillLayer, type PatternLayer } from "@/lib/artwork-stack";
import { GENERATORS, tileSizeFor } from "@/lib/pattern-generators/registry";
import type { PlacedAsset, RepeatSpec } from "./input";
import type { RepeatSpecRow } from "./types-art";

/** The resolution a picture is taken to have when its file states none. The print files assume the same. */
export const ASSUMED_DPI = 72;
const MM_PER_INCH = 25.4;

const round1 = (value: number): number => Math.round(value * 10) / 10 + 0;

/** Text with the keys of every object in order, so the record is the same on any machine. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const sorted = (params: PatternLayer["params"]): Record<string, number | string | boolean> =>
  Object.fromEntries(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1)));

function generatorRow(layer: PatternLayer): RepeatSpecRow {
  const generator = findGenerator(layer.generatorId, GENERATORS);
  const tile = generator === undefined ? null : tileSizeFor(layer.generatorId, layer.params);
  const name = generator?.label ?? layer.generatorId;
  const repeat =
    generator === undefined
      ? "This pattern is not one Knitwright knows, so its repeat is not known."
      : tile === null
        ? "Continuous across the whole design. It has no tile."
        : `Repeats every ${round1(tile.width)} mm across and ${round1(tile.height)} mm down.`;
  return {
    layerId: layer.id,
    layer: layer.name ?? name,
    kind: "generator",
    name,
    repeat,
    seed: layer.seed === undefined ? "No seed" : `Seed ${layer.seed}`,
    machine: stableJson({
      kind: "generator",
      layerId: layer.id,
      generatorId: layer.generatorId,
      params: sorted(layer.params),
      seed: layer.seed ?? null,
      repeat: tile === null ? "field" : "tile",
      tileMm: tile === null ? null : { width: round1(tile.width), height: round1(tile.height) },
      datum: layer.datum,
      colourIds: layer.colourIds,
    }),
  };
}

function tileRow(layer: ImageFillLayer, asset: PlacedAsset | undefined): RepeatSpecRow {
  const assumed = asset !== undefined && asset.dpiMeta === null;
  const dpi = asset?.dpiMeta ?? ASSUMED_DPI;
  const tile = asset === undefined ? null : { width: round1(((asset.widthPx / dpi) * MM_PER_INCH) * layer.scale), height: round1(((asset.heightPx / dpi) * MM_PER_INCH) * layer.scale) };
  const drop = layer.halfDrop ? "every other row dropped by half a repeat" : "rows in line";
  const repeat =
    tile === null
      ? `The size of the picture is not known, so the size of the repeat is not known. ${drop.charAt(0).toUpperCase()}${drop.slice(1)}.`
      : `Repeats every ${tile.width} mm across and ${tile.height} mm down, ${drop}.${assumed ? ` The picture states no resolution, so ${ASSUMED_DPI} dpi was assumed.` : ""}`;
  return {
    layerId: layer.id,
    layer: layer.name ?? asset?.label ?? layer.id,
    kind: "tile",
    name: asset?.label ?? layer.name ?? layer.assetId,
    repeat,
    seed: "No seed",
    machine: stableJson({
      kind: "tile",
      layerId: layer.id,
      assetId: layer.assetId,
      scale: layer.scale,
      rotationDeg: layer.rotationDeg,
      offsetMm: layer.offsetMm,
      halfDrop: layer.halfDrop,
      tileMm: tile,
    }),
  };
}

/**
 * The repeat of every pattern and every repeating picture of the stack, so any design has one, not only dots: the generator's
 * name, settings and seed, or the tile and its repeat size. A full-panel picture does not repeat and has no row.
 */
export function repeatSpecRows(stack: ArtworkStack, assets: readonly PlacedAsset[]): RepeatSpecRow[] {
  return stack.layers.flatMap((layer) => {
    if (layer.kind === "pattern") return [generatorRow(layer)];
    if (layer.kind === "image-fill" && layer.mode === "tile") return [tileRow(layer, assets.find((asset) => asset.id === layer.assetId))];
    return [];
  });
}

const number = (value: PatternLayer["params"][string] | undefined): number | null => (typeof value === "number" ? value : null);

/**
 * The polka-dot repeat of the stack as the sizes a person reads (dot size, pitch, row step, half drop), or null when the
 * stack has no dots or the dots do not state every size. Nothing is filled in for a size nobody gave.
 */
export function dotsRepeatOf(stack: ArtworkStack, colourwayId: string | undefined): RepeatSpec | null {
  const layer = stack.layers.find((entry): entry is PatternLayer => entry.kind === "pattern" && entry.generatorId === kitGeneratorId("dots"));
  if (layer === undefined) return null;
  const sizes = [layer.params.dotWidthMm, layer.params.pitchMm, layer.params.rowStepMm, layer.params.clearSpaceMm].map(number);
  const [diameterMm, pitchMm, rowStepMm, clearSpaceMm] = sizes;
  if (diameterMm == null || pitchMm == null || rowStepMm == null || clearSpaceMm == null || typeof layer.params.halfDrop !== "boolean") return null;
  const colourOf = (at: number): string => colourWords(resolveColour(stack, colourwayId, layer.colourIds[at] ?? ""));
  return { style: "dots", diameterMm, pitchMm, rowStepMm, halfDrop: layer.params.halfDrop, rowColours: { A: colourOf(0), B: colourOf(1) }, clearSpaceMm };
}
