import sharp from "sharp";
import { pointInPolygon, type Pt } from "../geometry/vec";
import type { PieceScene, RasterLayer, VectorLayer } from "../layout/scene";

/** The colour of the top vector shape at a print-space point, or null when nothing vector covers it. */
export function colourAt(scene: PieceScene, at: Pt): string | null {
  for (const layer of [...scene.layers].reverse()) {
    if (layer.kind !== "vector") continue;
    for (const { shape, fill } of [...(layer as VectorLayer).shapes].reverse()) {
      const inside = shape.reduce((n, ring) => n + (pointInPolygon(at, ring) ? 1 : 0), 0);
      if (inside % 2 === 1) return fill;
    }
  }
  return null;
}

/** The centre of the dark pixels of a raster layer within a window around a point (millimetres, print space). */
export async function darkCentroid(layer: RasterLayer, near: Pt, radiusMm: number): Promise<Pt | null> {
  let [sx, sy, n] = [0, 0, 0];
  for (const strip of layer.strips) {
    if (strip.box.maxY < near[1] - radiusMm || strip.box.minY > near[1] + radiusMm) continue;
    const { data, info } = await sharp(Buffer.from(strip.png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [mmX, mmY] = [(strip.box.maxX - strip.box.minX) / info.width, (strip.box.maxY - strip.box.minY) / info.height];
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const o = (y * info.width + x) * 4;
        if (data[o + 3] < 200 || data[o] > 40 || data[o + 1] > 40 || data[o + 2] > 40) continue;
        const [px, py] = [strip.box.minX + (x + 0.5) * mmX, strip.box.maxY - (y + 0.5) * mmY];
        if (Math.hypot(px - near[0], py - near[1]) > radiusMm) continue;
        sx += px;
        sy += py;
        n += 1;
      }
    }
  }
  return n === 0 ? null : [sx / n, sy / n];
}
