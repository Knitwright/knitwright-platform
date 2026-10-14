import sharp from "sharp";
import { blendNeedsRaster } from "@/lib/artwork-stack";
import { pageSizeMm, type PieceScene, type SceneItem } from "@/lib/print/scene";
import { buildSvg, type SvgParts, type SvgView } from "./svg";
import type { FlatArt } from "./types";

/** A piece never becomes more than this many pixels, so one file needs a known amount of memory. */
export const RASTER_PIXEL_CAP = 60_000_000;
/** Each strip of the page is drawn on its own, and holds about this many pixels. */
const STRIP_PIXELS = 4_000_000;

export interface RasterOptions {
  /** Defaults to the scene's own resolution. */
  readonly dpi?: number;
  readonly pixelCap?: number;
  /** A `#rrggbb` colour under everything, or null for a clear page. */
  readonly background: string | null;
  readonly art: boolean;
  readonly guides: boolean;
  readonly margin: boolean;
}

export interface RasterResult extends FlatArt {}

type SharpBlend = "over" | "multiply" | "screen" | "overlay";

interface Layer {
  readonly parts: SvgParts;
  readonly blend: SharpBlend;
}

interface Grid {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpi: number;
  readonly dpiNote: string | null;
}

const pixelsAt = (widthMm: number, heightMm: number, dpi: number): { w: number; h: number } => ({
  w: Math.max(1, Math.round((widthMm / 25.4) * dpi)),
  h: Math.max(1, Math.round((heightMm / 25.4) * dpi)),
});

/** The pixel grid for the page, lowering the resolution (to a whole number) when it would pass the cap. */
export function pixelGrid(scene: PieceScene, requested: number, cap: number): Grid {
  const size = pageSizeMm(scene);
  const wanted = Math.max(1, Math.round(requested));
  let dpi = wanted;
  let { w, h } = pixelsAt(size.width, size.height, dpi);
  if (w * h > cap) {
    dpi = Math.max(1, Math.floor(wanted * Math.sqrt(cap / (w * h))));
    ({ w, h } = pixelsAt(size.width, size.height, dpi));
    while (w * h > cap && dpi > 1) {
      dpi -= 1;
      ({ w, h } = pixelsAt(size.width, size.height, dpi));
    }
  }
  const dpiNote = dpi < wanted ? `Resolution lowered from ${wanted} to ${dpi} dpi so the file fits the size limit.` : null;
  return { widthPx: w, heightPx: h, dpi, dpiNote };
}

const blendOf = (item: SceneItem): SharpBlend => (blendNeedsRaster(item.blend) ? (item.blend as SharpBlend) : "over");

/** Runs of items from one stack layer, in stack order. */
export function layerGroups(items: readonly SceneItem[]): readonly (readonly SceneItem[])[] {
  const groups: SceneItem[][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0]?.layerId === item.layerId) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

const baseParts = (): SvgParts => ({
  items: [],
  background: null,
  art: false,
  guides: false,
  margin: false,
  meta: false,
  forceNormal: false,
});

function layerPlan(scene: PieceScene, options: RasterOptions): readonly Layer[] {
  const base = baseParts();
  if (!scene.raster) {
    return [{ parts: { ...base, items: scene.items, background: options.background, art: options.art, guides: options.guides, margin: options.margin }, blend: "over" }];
  }
  const layers: Layer[] = [];
  if (options.background) layers.push({ parts: { ...base, background: options.background }, blend: "over" });
  if (options.art) {
    for (const group of layerGroups(scene.items)) {
      const first = group[0];
      layers.push({ parts: { ...base, items: group, art: true, forceNormal: true }, blend: first ? blendOf(first) : "over" });
    }
  }
  if (options.guides || options.margin) layers.push({ parts: { ...base, guides: options.guides, margin: options.margin }, blend: "over" });
  return layers;
}

function stripView(scene: PieceScene, grid: Grid, top: number, rows: number): SvgView {
  const size = pageSizeMm(scene);
  const perRow = size.height / grid.heightPx;
  return { x: 0, y: top * perRow, width: size.width, height: rows * perRow, widthAttr: String(grid.widthPx), heightAttr: String(rows), places: 4, keepAspect: false };
}

async function renderStrip(scene: PieceScene, layers: readonly Layer[], grid: Grid, top: number, rows: number): Promise<Buffer> {
  const view = stripView(scene, grid, top, rows);
  const rendered = await Promise.all(layers.map((layer) => sharp(Buffer.from(buildSvg(scene, view, layer.parts))).png().toBuffer()));
  const [first, ...rest] = rendered;
  if (!first) return sharp({ create: { width: grid.widthPx, height: rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  if (rest.length === 0) return first;
  const blends = layers.slice(1);
  return sharp(first).composite(rest.map((input, index) => ({ input, blend: blends[index]?.blend ?? "over" }))).png().toBuffer();
}

/**
 * Draws the page as pixels, a strip at a time. The SVG made for each strip lives only in memory,
 * as an input to sharp. A scene with a blending layer is composited layer by layer.
 */
export async function rasterise(scene: PieceScene, options: RasterOptions): Promise<RasterResult> {
  const grid = pixelGrid(scene, options.dpi ?? scene.dpi, options.pixelCap ?? RASTER_PIXEL_CAP);
  const layers = layerPlan(scene, options);
  const rowsPerStrip = Math.max(1, Math.floor(STRIP_PIXELS / grid.widthPx));
  const strips: { input: Buffer; top: number; left: number }[] = [];
  for (let top = 0; top < grid.heightPx; top += rowsPerStrip) {
    const rows = Math.min(rowsPerStrip, grid.heightPx - top);
    strips.push({ input: await renderStrip(scene, layers, grid, top, rows), top, left: 0 });
  }
  const canvas = sharp({ create: { width: grid.widthPx, height: grid.heightPx, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const png = await canvas.composite(strips.map((strip) => ({ ...strip, blend: "over" as const }))).png().toBuffer();
  return { png, widthPx: grid.widthPx, heightPx: grid.heightPx, dpi: grid.dpi, dpiNote: grid.dpiNote };
}

/** The art alone as one picture with the blends applied. Guides and margin are not in it. */
export const flattenScene = (scene: PieceScene, options: { readonly dpi?: number; readonly pixelCap?: number } = {}): Promise<FlatArt> =>
  rasterise(scene, { ...options, background: null, art: true, guides: false, margin: false });
