import type { GraphicLayer, PointMm, ViewId } from "@/lib/artwork-stack";
import type { Shape } from "../geometry/boolean";
import { distance, type Pt } from "../geometry/vec";
import type { BuildEnv } from "./context";
import { ASSUMED_PICTURE_DPI, dpiSentence, effectiveDpi, resampleToPng, type ImageSet } from "./images";
import { emptyPlan, grownBox, insideRect, turnedRect, type MarkPlan } from "./marks";
import { OUTSIDE_ZONES_SENTENCE, isProblem, resolvePlace, type ResolvedPlace } from "./placement";
import type { PrintSpace } from "./print-space";
import type { FilledShape, Issue } from "./scene";
import { parseVectorCopy, ringsOf } from "./vector-asset";
import { zoneRectangle } from "../zones";

interface Where {
  readonly view: ViewId;
  readonly size: string;
  readonly space: PrintSpace;
  readonly index: number;
}

const name = (layer: GraphicLayer): string => layer.name ?? "A picture";

/** Zone and anchor checks for a placed rectangle: reported, never moved. */
function placeIssues(layer: GraphicLayer, env: BuildEnv, where: Where, place: ResolvedPlace, corners: readonly PointMm[]): Issue[] {
  const label = name(layer);
  if (place.zone !== null) {
    const zone = zoneRectangle(env.mapper, place.zone, where.size);
    return zone !== null && !insideRect(corners, zone, 0.5)
      ? [{ code: "larger-than-zone", layerId: layer.id, text: `${label} is larger than its zone (${place.zone.purpose.replaceAll("-", " ")}).` }]
      : [];
  }
  const inAny = env.zoneTemplates
    .filter((t) => t.view === where.view)
    .some((t) => {
      const zone = zoneRectangle(env.mapper, t, where.size);
      return zone !== null && insideRect(corners, zone, 0.5);
    });
  return inAny ? [] : [{ code: "outside-zones", layerId: layer.id, text: OUTSIDE_ZONES_SENTENCE(label) }];
}

function vectorShapes(layer: GraphicLayer, bytes: Uint8Array, corners: readonly PointMm[], space: PrintSpace): { shapes: FilledShape[] } | null {
  const copy = parseVectorCopy(bytes);
  if (copy === null) return null;
  const [tl, tr, , bl] = corners;
  const [ux, uy, vx, vy] = [(tr.x - tl.x) / copy.width, (tr.y - tl.y) / copy.width, (bl.x - tl.x) / copy.height, (bl.y - tl.y) / copy.height];
  const shapes = ringsOf(copy).map(({ fill, rings }): FilledShape => ({
    fill,
    shape: rings.map((ring) => ring.map(([x, y]) => space.toPrint({ x: tl.x + x * ux + y * vx, y: tl.y + x * uy + y * vy }))) as Shape,
  }));
  void layer;
  return { shapes };
}

async function rasterSet(env: BuildEnv, layer: GraphicLayer, bytes: Uint8Array, corners: readonly PointMm[], space: PrintSpace): Promise<ImageSet> {
  const [tl, tr, , bl] = corners;
  const [p0, p1, p2] = [space.toPrint(tl), space.toPrint(tr), space.toPrint(bl)];
  const pxPerMm = env.settings.dpi / 25.4;
  const [wPx, hPx] = [Math.max(1, Math.round(distance(p0, p1) * pxPerMm)), Math.max(1, Math.round(distance(p0, p2) * pxPerMm))];
  const png = await resampleToPng(bytes, wPx, hPx, null);
  const id = `g-${layer.id}`;
  return {
    tiles: [{ id, png, widthPx: wPx, heightPx: hPx }],
    instances: [{ tile: id, origin: p0, ex: [(p1[0] - p0[0]) / wPx, (p1[1] - p0[1]) / wPx], ey: [(p2[0] - p0[0]) / hPx, (p2[1] - p0[1]) / hPx] }],
  };
}

/** A placed logo or picture: on its zone or anchor, vector kept as vector, raster at the file's resolution. */
export async function planGraphic(env: BuildEnv, layer: GraphicLayer, where: Where): Promise<MarkPlan> {
  const { view, size, space, index } = where;
  const place = resolvePlace(env, view, size, layer.placement);
  if (isProblem(place)) return emptyPlan(layer.id, index, [{ code: "not-placed", layerId: layer.id, text: place.problem }]);
  const assetId = layer.source.kind === "asset" ? layer.source.assetId : layer.source.fileId;
  const asset = await env.assets.getAsset(assetId);
  if (asset === null) return emptyPlan(layer.id, index, [{ code: "asset-missing", layerId: layer.id, text: `${name(layer)} is not available to the print files, so it is left out of this file.` }]);
  const widthMm = layer.widthMm;
  const heightMm = layer.heightMm ?? widthMm * (asset.heightPx / asset.widthPx);
  const centre: PointMm = { x: place.centre.x + layer.offsetMm.x, y: place.centre.y + layer.offsetMm.y };
  const corners = turnedRect(centre, widthMm, heightMm, layer.rotationDeg);
  const issues = placeIssues(layer, env, where, place, grownBox(corners, 0));
  const bytes = await asset.readPrintCopy();
  const base = { layerId: layer.id, index, core: grownBox(corners, 0), ownClearMm: layer.clearSpaceMm, cuts: layer.knockOut, paintsNothing: layer.blend === "knock-out", notes: [] as string[] };
  if (asset.kind === "vector") {
    const vector = vectorShapes(layer, bytes, corners, space);
    if (vector === null) return emptyPlan(layer.id, index, [...issues, { code: "asset-missing", layerId: layer.id, text: `${name(layer)} could not be read as a vector, so it is left out of this file.` }]);
    return { ...base, shapes: vector.shapes, images: null, issues, lowestDpi: null };
  }
  const dpi = effectiveDpi(asset.widthPx, widthMm);
  const notes = asset.dpiMeta === null ? [`${name(layer)} states no resolution; it was sized as ${ASSUMED_PICTURE_DPI} dpi.`] : [];
  const low: Issue[] = dpi < env.settings.minDpi ? [{ code: "below-min-dpi", layerId: layer.id, text: dpiSentence(name(layer), dpi, env.settings.minDpi, asset.widthPx) }] : [];
  return { ...base, shapes: [], images: await rasterSet(env, layer, bytes, corners, space), issues: [...issues, ...low], notes, lowestDpi: dpi };
}

export type { Pt };
