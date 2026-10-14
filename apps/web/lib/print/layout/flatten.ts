import sharp from "sharp";
import { blendNeedsRaster, type Blend } from "@/lib/artwork-stack";
import { stripsOf, type PixelGrid } from "../raster/grid";
import { svgToPng } from "../raster/rasterise";
import { buildSvg } from "../render/svg";
import type { PieceScene, RasterLayer, RasterStrip, SceneLayer } from "./scene";

/** The first layer that mixes pixels with what is under it, or null when every layer stays vector. */
export function layerNeedingPixels(layers: readonly SceneLayer[]): SceneLayer | null {
  return layers.find((l) => blendNeedsRaster(l.blend)) ?? null;
}

const SHARP_BLEND: Readonly<Record<Blend, "over" | "multiply" | "screen" | "overlay">> = {
  normal: "over",
  "knock-out": "over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
};

/**
 * Makes every layer of a piece into pixels, mixing them in the stack's order with each layer's blend. This is the
 * only way multiply, screen and overlay can be printed; the piece's margin says so. Each layer is drawn alone (with its
 * own opacity) and laid over the strip with its blend, one strip at a time, so memory stays within the strip budget.
 */
export async function flattenLayers(scene: PieceScene, grid: PixelGrid, budget?: number): Promise<RasterLayer> {
  const strips: RasterStrip[] = [];
  for (const strip of stripsOf(scene.box, grid, budget)) {
    const size = { width: strip.widthPx, height: strip.heightPx };
    let painted = await sharp({ create: { ...size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    for (const layer of scene.layers) {
      const svg = buildSvg(
        { ...scene, layers: [{ ...layer, blend: "normal" }] },
        { region: strip.box, pixels: { widthPx: strip.widthPx, heightPx: strip.heightPx }, guides: false, slug: [], background: null },
      );
      const top = Buffer.from(await svgToPng(svg));
      painted = await sharp(painted).composite([{ input: top, blend: SHARP_BLEND[layer.blend] }]).png({ compressionLevel: 6, adaptiveFiltering: false }).toBuffer();
    }
    strips.push({ box: strip.box, widthPx: strip.widthPx, heightPx: strip.heightPx, png: new Uint8Array(painted) });
  }
  return { kind: "raster", layerId: "flattened", opacity: 1, blend: "normal", dpi: grid.dpi, strips };
}
