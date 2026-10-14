import type { ImageFillLayer, PointMm, ViewId } from "@/lib/artwork-stack";
import { boundsOf, distance, type Pt } from "../geometry/vec";
import { screenColour, type BuildEnv } from "./context";
import { ASSUMED_PICTURE_DPI, dpiSentence, effectiveDpi, resampleToPng, type ImageInstance, type ImageSet } from "./images";
import type { PrintSpace } from "./print-space";
import type { Issue } from "./scene";

export interface ImageFillPlan {
  readonly set: ImageSet | null;
  readonly issues: readonly Issue[];
  readonly notes: readonly string[];
  readonly lowestDpi: number | null;
}

/** The most tiles one piece takes from one repeating picture. Over it, the picture is too small to repeat sensibly. */
export const MAX_TILES = 20_000;

const none = (issues: Issue[]): ImageFillPlan => ({ set: null, issues, notes: [], lowestDpi: null });

interface Lattice {
  readonly origin: PointMm;
  readonly cos: number;
  readonly sin: number;
}

/** A point of the picture's own grid (millimetres, y down) on the design plane. */
const onPlane = (l: Lattice, u: number, v: number): PointMm => ({ x: l.origin.x + u * l.cos - v * l.sin, y: l.origin.y + u * l.sin + v * l.cos });
const inLattice = (l: Lattice, p: PointMm): [number, number] => {
  const [dx, dy] = [p.x - l.origin.x, p.y - l.origin.y];
  return [dx * l.cos + dy * l.sin, -dx * l.sin + dy * l.cos];
};

function instance(space: PrintSpace, l: Lattice, tile: string, u: number, v: number, wMm: number, hMm: number, wPx: number, hPx: number): ImageInstance {
  const [p0, p1, p2] = [space.toPrint(onPlane(l, u, v)), space.toPrint(onPlane(l, u + wMm, v)), space.toPrint(onPlane(l, u, v + hMm))];
  return { tile, origin: p0, ex: [(p1[0] - p0[0]) / wPx, (p1[1] - p0[1]) / wPx], ey: [(p2[0] - p0[0]) / hPx, (p2[1] - p0[1]) / hPx] };
}

function tilePixels(env: BuildEnv, space: PrintSpace, l: Lattice, wMm: number, hMm: number): [number, number] {
  const [a, b, c] = [space.toPrint(onPlane(l, 0, 0)), space.toPrint(onPlane(l, wMm, 0)), space.toPrint(onPlane(l, 0, hMm))];
  const k = env.settings.dpi / 25.4;
  return [Math.max(1, Math.round(distance(a, b) * k)), Math.max(1, Math.round(distance(a, c) * k))];
}

export interface FillInput {
  readonly env: BuildEnv;
  readonly layer: ImageFillLayer;
  readonly view: ViewId;
  readonly size: string;
  readonly space: PrintSpace;
  readonly bleedOutline: readonly Pt[];
}

/**
 * A picture used to fill: a repeating tile on the shared datum (so the repeat runs through seams), or one picture fitted to
 * the piece's panel, covering the page including its bleed so the art continues into the bleed.
 */
export async function planImageFill(input: FillInput): Promise<ImageFillPlan> {
  const { env, layer, size, space } = input;
  const asset = await env.assets.getAsset(layer.assetId);
  const label = "The picture fill";
  if (asset === null) return none([{ code: "asset-missing", layerId: layer.id, text: `${label} is not available to the print files, so it is left out of this file.` }]);
  if (asset.kind !== "raster") return none([{ code: "asset-missing", layerId: layer.id, text: `${label} is a vector, which cannot fill a panel yet, so it is left out of this file.` }]);
  const bytes = await asset.readPrintCopy();
  const naturalDpi = asset.dpiMeta ?? ASSUMED_PICTURE_DPI;
  const natural = { w: (asset.widthPx / naturalDpi) * 25.4, h: (asset.heightPx / naturalDpi) * 25.4 };
  const plane = input.bleedOutline.map(space.toPlane);
  const box = boundsOf(plane.map((p): Pt => [p.x, p.y]));
  const recolour = layer.recolourIds?.[0] === undefined ? null : screenColour(env, layer.recolourIds[0]);
  const notes = asset.dpiMeta === null ? [`${label} states no resolution; it was sized as ${ASSUMED_PICTURE_DPI} dpi.`] : [];
  const rad = (layer.rotationDeg * Math.PI) / 180;
  const heightOfChest = env.mapper.landmarkPlane("front", "underarm", size)?.y ?? 0;

  if (layer.mode === "tile") {
    const [w, h] = [natural.w * layer.scale, natural.h * layer.scale];
    const l: Lattice = { origin: { x: layer.offsetMm.x, y: heightOfChest + layer.offsetMm.y }, cos: Math.cos(rad), sin: Math.sin(rad) };
    const corners = [inLattice(l, { x: box.minX, y: box.minY }), inLattice(l, { x: box.maxX, y: box.minY }), inLattice(l, { x: box.maxX, y: box.maxY }), inLattice(l, { x: box.minX, y: box.maxY })];
    const [us, vs] = [corners.map((c) => c[0]), corners.map((c) => c[1])];
    const [c0, c1] = [Math.floor(Math.min(...us) / w) - 1, Math.ceil(Math.max(...us) / w) + 1];
    const [r0, r1] = [Math.floor(Math.min(...vs) / h) - 1, Math.ceil(Math.max(...vs) / h) + 1];
    if ((c1 - c0 + 1) * (r1 - r0 + 1) > MAX_TILES) return none([{ code: "asset-missing", layerId: layer.id, text: `${label} repeats more than ${MAX_TILES} times on one piece, so it is left out. Make the repeat bigger.` }]);
    const [wPx, hPx] = tilePixels(env, space, l, w, h);
    const id = `t-${layer.id}`;
    const png = await resampleToPng(bytes, wPx, hPx, recolour);
    const instances: ImageInstance[] = [];
    for (let c = c0; c <= c1; c += 1) {
      const drop = layer.halfDrop && Math.abs(c) % 2 === 1 ? h / 2 : 0;
      for (let r = r0; r <= r1; r += 1) instances.push(instance(space, l, id, c * w, r * h + drop, w, h, wPx, hPx));
    }
    return finish({ tiles: [{ id, png, widthPx: wPx, heightPx: hPx }], instances }, layer, env, asset.widthPx, w, notes);
  }

  const [bw, bh] = [box.maxX - box.minX, box.maxY - box.minY];
  const k = (layer.fit === "cover" ? Math.max(bw / natural.w, bh / natural.h) : Math.min(bw / natural.w, bh / natural.h)) * layer.scale;
  const [w, h] = [natural.w * k, natural.h * k];
  const centre: PointMm = { x: (box.minX + box.maxX) / 2 + layer.offsetMm.x, y: (box.minY + box.maxY) / 2 + layer.offsetMm.y };
  const l: Lattice = { origin: centre, cos: Math.cos(rad), sin: Math.sin(rad) };
  const [wPx, hPx] = tilePixels(env, space, l, w, h);
  const png = await resampleToPng(bytes, wPx, hPx, recolour);
  const id = `p-${layer.id}`;
  return finish({ tiles: [{ id, png, widthPx: wPx, heightPx: hPx }], instances: [instance(space, l, id, -w / 2, -h / 2, w, h, wPx, hPx)] }, layer, env, asset.widthPx, w, notes);
}

function finish(set: ImageSet, layer: ImageFillLayer, env: BuildEnv, sourcePx: number, printedMm: number, notes: readonly string[]): ImageFillPlan {
  const dpi = effectiveDpi(sourcePx, printedMm);
  const low: Issue[] = dpi < env.settings.minDpi ? [{ code: "below-min-dpi", layerId: layer.id, text: dpiSentence("The picture fill", dpi, env.settings.minDpi, sourcePx) }] : [];
  return { set, issues: low, notes, lowestDpi: dpi };
}
