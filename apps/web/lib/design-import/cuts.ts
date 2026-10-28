import type { ViewFit } from "./fit";
import { warpToDesign } from "./fit";
import type { PictureCut } from "./pattern";
import { encodePng, type Raster } from "./raster";

/**
 * Cutting a picture for an `image-fill` layer out of the original, at the original's own sharpness: a tile or a
 * full panel, flattened into design space by the fit. A full-panel picture is clear off the garment, so only the
 * garment is printed.
 */

/** A cut picture, ready to be stored as the person's artwork (W7b intake) under `assetId`. */
export interface PictureFile {
  readonly assetId: string;
  readonly view: PictureCut["view"];
  readonly png: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly widthMm: number;
  /** The `scale` the layer needs so the picture prints at the size it was cut at: 1 when the file's stated resolution is the true one. */
  readonly scale: number;
  /** True when the pixels came from an image model's clean-up. */
  readonly generated: boolean;
}

/** The longest side of a cut picture. */
export const MOST_CUT_PX = 2048;
/** The lowest resolution a PNG can state. A picture cut at fewer dots per inch is stated as this many, and its layer is scaled up to make up the difference. */
export const LEAST_STATED_DPI = 50;

interface CutSource {
  /** The picture at its best resolution with the marks repaired from the cloth around them. */
  readonly raster: Raster;
  /** Pixels of `raster` for each pixel of the picture the fit was made on. */
  readonly scale: number;
  readonly fit: ViewFit;
  /** 255 on the garment, in the fit's picture. */
  readonly mask: Raster;
  readonly generated: boolean;
}

export async function cutPicture(cut: PictureCut, source: CutSource): Promise<PictureFile> {
  const { area } = cut;
  const [widthMm, heightMm] = [area.maxX - area.minX, area.maxY - area.minY];
  // One picture pixel for each pixel of the original, unless that is more than the cut may hold.
  const step = Math.max(source.fit.mmPerPixel / source.scale, Math.max(widthMm, heightMm) / MOST_CUT_PX);
  const colour = warpToDesign(source.raster, source.fit, area, step, source.scale);
  const data = new Uint8ClampedArray(colour.data);
  const clear = cut.clip ? warpToDesign(source.mask, source.fit, area, step, 1) : null;
  for (let at = 0; at < colour.width * colour.height; at += 1) {
    const covered = clear === null ? colour.data[at * 4 + 3] > 0 : clear.data[at * 4] > 127 && colour.data[at * 4 + 3] > 0;
    data[at * 4 + 3] = covered ? 255 : 0;
  }
  const raster: Raster = { width: colour.width, height: colour.height, data };
  const stated = Math.max(LEAST_STATED_DPI, Math.round(25.4 / step));
  return {
    assetId: cut.assetId,
    view: cut.view,
    png: await encodePng(raster, stated),
    widthPx: raster.width,
    heightPx: raster.height,
    widthMm,
    scale: Math.round(((stated * step) / 25.4) * 10_000) / 10_000,
    generated: source.generated,
  };
}

/** The garment mask as a picture, so it can be flattened by the same fit as the colours. */
export function maskRaster(mask: Uint8Array, width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let at = 0; at < mask.length; at += 1) data.set([mask[at] === 0 ? 0 : 255, 0, 0, 255], at * 4);
  return { width, height, data };
}

/** A crest, sponsor or badge cut from the picture, to be stored as artwork the person is asked to replace. */
export interface CropFile {
  readonly assetId: string;
  readonly view: PictureCut["view"];
  readonly png: Uint8Array;
}

/** Cuts a rectangle of the analysis picture out of the better copy of it. */
export async function cropFile(crop: { assetId: string; view: PictureCut["view"]; rect: { x0: number; y0: number; x1: number; y1: number } }, source: { raster: Raster; scale: number }): Promise<CropFile> {
  const { raster, scale } = source;
  const [x0, y0] = [Math.max(0, Math.floor(crop.rect.x0 * scale)), Math.max(0, Math.floor(crop.rect.y0 * scale))];
  const [x1, y1] = [Math.min(raster.width, Math.ceil(crop.rect.x1 * scale)), Math.min(raster.height, Math.ceil(crop.rect.y1 * scale))];
  const [width, height] = [Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) data.set(raster.data.subarray(((y0 + y) * raster.width + x0) * 4, ((y0 + y) * raster.width + x0 + width) * 4), y * width * 4);
  return { assetId: crop.assetId, view: crop.view, png: await encodePng({ width, height, data }) };
}
