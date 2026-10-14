import sharp from "sharp";
import { clipShape, subtractRegions, type Shape } from "../geometry/boolean";
import { boundsOf, boxesOverlap, round2, type Box, type Pt } from "../geometry/vec";
import { pageMap, pathData, num } from "../render/svg-util";
import { svgToPng } from "../raster/rasterise";
import { stripsOf, type PixelGrid } from "../raster/grid";
import type { RasterStrip } from "./scene";

/** A picture at the file's resolution, ready to be placed more than once. */
export interface ImageTile {
  readonly id: string;
  readonly png: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** One placing of a tile: the print-space point of its top left corner, and the vectors one pixel across and one pixel down. */
export interface ImageInstance {
  readonly tile: string;
  readonly origin: Pt;
  readonly ex: Pt;
  readonly ey: Pt;
}

export interface ImageSet {
  readonly tiles: readonly ImageTile[];
  readonly instances: readonly ImageInstance[];
}

/** When a file states no resolution it is treated as the screen's 96 dpi, and the margin says so. */
export const ASSUMED_PICTURE_DPI = 96;

/** Resolution of a picture as placed: its pixels over the width it prints, in inches. Pre-shrink: the garment ends at this size. */
export const effectiveDpi = (sourcePx: number, printedMm: number): number => (printedMm <= 0 ? Infinity : sourcePx / (printedMm / 25.4));

/** The largest width, in millimetres, at which a picture still meets the minimum resolution. */
export const largestWidthMm = (sourcePx: number, minDpi: number): number => (sourcePx / minDpi) * 25.4;

export function dpiSentence(layerName: string, dpi: number, minDpi: number, sourcePx: number): string {
  return `${layerName} would print at about ${Math.round(dpi)} dpi at this size. Your print house asks for ${minDpi} or more, so it may look soft. Use a larger file, or make it smaller on the shirt (up to ${Math.floor(largestWidthMm(sourcePx, minDpi))} mm wide it still meets ${minDpi} dpi).`;
}

/** Pixels once, to the width and height they print at. The picture keeps its own axes; turning to the piece is done when it is placed. */
export async function resampleToPng(bytes: Uint8Array, widthPx: number, heightPx: number, recolour: string | null): Promise<Uint8Array> {
  let image = sharp(Buffer.from(bytes), { limitInputPixels: false }).rotate().ensureAlpha();
  if (recolour !== null) {
    const alpha = await image.clone().extractChannel(3).toBuffer();
    const { width, height } = await image.metadata();
    image = sharp({ create: { width: width ?? 1, height: height ?? 1, channels: 4, background: recolour } }).joinChannel(alpha, { raw: { width: width ?? 1, height: height ?? 1, channels: 1 } }).ensureAlpha();
  }
  const out = await image.resize(Math.max(1, widthPx), Math.max(1, heightPx), { fit: "fill", kernel: "lanczos3" }).png({ compressionLevel: 6, adaptiveFiltering: false }).toBuffer();
  return new Uint8Array(out);
}

const corners = (i: ImageInstance, w: number, h: number): Pt[] => [
  i.origin,
  [i.origin[0] + i.ex[0] * w, i.origin[1] + i.ex[1] * w],
  [i.origin[0] + i.ex[0] * w + i.ey[0] * h, i.origin[1] + i.ex[1] * w + i.ey[1] * h],
  [i.origin[0] + i.ey[0] * h, i.origin[1] + i.ey[1] * h],
];

/** The shape of the ground a picture is allowed on: the bleed outline less every hole (clear space and knock-outs). */
export function paintable(outline: readonly Pt[], holes: readonly (readonly Pt[])[]): Shape {
  const cut = subtractRegions([[outline]], holes);
  return cut.length === 0 ? [] : cut.flat();
}

/**
 * Draws the pictures into strips, each within the memory budget, cut to the paintable shape. A strip no picture
 * reaches is left out. Pictures are drawn through the same pipeline for every file format.
 */
export async function rasteriseImageSet(set: ImageSet, paint: Shape, page: Box, grid: PixelGrid, budget?: number): Promise<RasterStrip[]> {
  const tiles = new Map(set.tiles.map((t) => [t.id, t]));
  const to = pageMap(page);
  const clip = pathData(paint, to);
  const boxes = set.instances.map((i) => {
    const t = tiles.get(i.tile)!;
    return boundsOf(corners(i, t.widthPx, t.heightPx));
  });
  const out: RasterStrip[] = [];
  for (const strip of stripsOf(page, grid, budget)) {
    const at = set.instances.map((_, k) => k).filter((k) => boxesOverlap(boxes[k], strip.box));
    if (at.length === 0 || clip === "") continue;
    const used = [...new Set(at.map((k) => set.instances[k].tile))].sort();
    const defs = used.map((id) => {
      const t = tiles.get(id)!;
      return `<image id="${id}" width="${t.widthPx}" height="${t.heightPx}" preserveAspectRatio="none" href="data:image/png;base64,${Buffer.from(t.png).toString("base64")}"/>`;
    });
    const uses = at.map((k) => {
      const i = set.instances[k];
      return `<use href="#${i.tile}" transform="matrix(${[i.ex[0], -i.ex[1], i.ey[0], -i.ey[1], i.origin[0] - page.minX, page.maxY - i.origin[1]].map(num).join(" ")})"/>`;
    });
    const top = (page.maxY - strip.box.maxY);
    const [w, h] = [page.maxX - page.minX, strip.box.maxY - strip.box.minY];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${strip.widthPx}" height="${strip.heightPx}" viewBox="0 ${num(top)} ${num(w)} ${num(h)}">` +
      `<defs><clipPath id="paint"><path clip-rule="evenodd" d="${clip}"/></clipPath>${defs.join("")}</defs><g clip-path="url(#paint)">${uses.join("")}</g></svg>`;
    out.push({ box: strip.box, widthPx: strip.widthPx, heightPx: strip.heightPx, png: await svgToPng(svg) });
  }
  return out;
}

export { clipShape, round2 };
