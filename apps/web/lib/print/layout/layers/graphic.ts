import type { GraphicLayer, PointMm } from "@/lib/artwork-stack";
import { growRing } from "../../geometry/clip";
import { applyAll, compose, rotation, scaling, translation, type Affine, type Pt } from "../../geometry/affine";
import type { FillItem, ImageItem, PrintIssue, Ring, SceneItem, StrokeItem } from "../../scene";
import { dpiIssue, effectiveDpi, largestWidthMm } from "../../rules/checks";
import { lineIssue } from "../../rules/checks";
import { markReport, markRing, resolvePlacement } from "../placement";
import { preparePicture, PICTURE_REFUSED } from "../pictures";
import type { Built, LayerResult, LayerSpace } from "../types";
import { readVectorArt, VECTOR_REFUSED, type VectorArt } from "../vector-art";

/** A logo added before full size copies were kept has only a screen copy, which never goes to print. */
export const OLD_LOGO = "This logo was added before full size copies were kept, so it was left off. Upload it again to print it.";

const stop = (text: string): LayerResult => ({ built: [], knock: [], colours: [], dpis: [], issues: [{ severity: "stop", text }] });

/** The sentence for a picture that is too small to print well, with the largest size it would still print at. */
export function softPictureIssue(dpi: number, space: LayerSpace, widthPx: number): PrintIssue | null {
  const { minDpi } = space.input.settings;
  const issue = dpiIssue(dpi, minDpi);
  if (!issue) return null;
  return { ...issue, text: `${issue.text} It would still meet ${minDpi} dpi up to about ${Math.floor(largestWidthMm(widthPx, minDpi) / 10)} cm wide.` };
}

/** Pixels or vector points in the art's own box (centred, y down) onto the design plane, then onto the piece. */
function placeMatrix(space: LayerSpace, centre: PointMm, offset: PointMm, sx: number, sy: number, widthUnits: number, heightUnits: number, rotationDeg: number): Affine {
  const local = compose(scaling(sx, sy), translation(-widthUnits / 2, -heightUnits / 2));
  const turned = compose(rotation((rotationDeg * Math.PI) / 180), local);
  const design = compose(translation(centre.x + offset.x, centre.y + offset.y), turned);
  return compose(space.toPiece, design);
}

function vectorItems(layer: GraphicLayer, art: VectorArt, matrix: Affine, ratio: number): { items: SceneItem[]; issues: PrintIssue[]; colours: string[] } {
  const items: SceneItem[] = [];
  const issues: PrintIssue[] = [];
  const colours: string[] = [];
  for (const shape of art.shapes) {
    const rings = shape.rings.map((ring): Ring => applyAll(matrix, ring as Pt[]));
    if (shape.fill) {
      colours.push(shape.fill);
      items.push({ kind: "fill", layerId: layer.id, rings, colour: shape.fill.toLowerCase(), opacity: layer.opacity, blend: layer.blend } satisfies FillItem);
    }
    if (shape.stroke) {
      const widthMm = shape.stroke.widthMm * ratio;
      colours.push(shape.stroke.colour);
      for (const ring of rings) items.push({ kind: "stroke", layerId: layer.id, points: ring, closed: shape.closed, widthMm, colour: shape.stroke.colour.toLowerCase(), opacity: layer.opacity, blend: layer.blend } satisfies StrokeItem);
    }
  }
  return { items, issues, colours };
}

/** A placed logo or picture. A vector asset stays vector; a raster is resampled once to the print resolution. */
export async function graphicLayer(layer: GraphicLayer, space: LayerSpace): Promise<LayerResult> {
  const { input } = space;
  const where = resolvePlacement(layer.placement, space);
  if ("issue" in where) return { ...stop(where.issue.text), issues: [where.issue] };
  const { placed } = where;
  const assetId = layer.source.kind === "asset" ? layer.source.assetId : layer.source.fileId;
  const asset = await input.assets.getAsset(assetId);
  if (!asset) return stop(layer.source.kind === "file" ? OLD_LOGO : `The artwork for "${layer.name ?? layer.id}" is not available, so it was left off.`);
  const bytes = await asset.readPrintCopy();
  const widthMm = layer.widthMm;
  let heightMm = layer.heightMm ?? (widthMm * asset.heightPx) / asset.widthPx;
  let built: Built[] = [];
  let issues: PrintIssue[] = [];
  let colours: string[] = [];
  const dpis: number[] = [];
  if (asset.kind === "vector") {
    const read = readVectorArt(bytes);
    if (!read) return stop(VECTOR_REFUSED);
    const { art } = read;
    heightMm = layer.heightMm ?? (widthMm * art.height) / art.width;
    const sx = widthMm / art.width;
    const matrix = placeMatrix(space, placed.centre, layer.offsetMm, sx, heightMm / art.height, art.width, art.height, layer.rotationDeg);
    const made = vectorItems(layer, art, matrix, sx);
    built = made.items.map((item): Built => ({ item, kind: "graphic" }));
    colours = made.colours;
    issues = read.notes.map((text): PrintIssue => ({ severity: "note", text }));
    issues = issues.concat(art.shapes.flatMap((shape) => (shape.stroke ? [lineIssue(shape.stroke.widthMm * sx, input.rules, layer.name ?? layer.id)] : [])).filter((i): i is PrintIssue => i !== null));
  } else {
    const picture = await preparePicture(bytes, widthMm, input.settings.dpi);
    if (!picture) return stop(PICTURE_REFUSED);
    const dpi = effectiveDpi(picture.sourceWidthPx, widthMm);
    dpis.push(dpi);
    const soft = softPictureIssue(dpi, space, picture.sourceWidthPx);
    if (soft) issues.push(soft);
    const matrix = placeMatrix(space, placed.centre, layer.offsetMm, widthMm / picture.widthPx, heightMm / picture.heightPx, picture.widthPx, picture.heightPx, layer.rotationDeg);
    const item: ImageItem = { kind: "image", layerId: layer.id, imageId: picture.imageId, png: picture.png, widthPx: picture.widthPx, heightPx: picture.heightPx, matrix, clip: [space.visible], opacity: layer.opacity, blend: layer.blend };
    built = [{ item, kind: "graphic" }];
  }
  const ring = markRing(placed.centre, layer.offsetMm, widthMm, heightMm, layer.rotationDeg, space.toPiece);
  const report = markReport(layer.id, ring, placed, space);
  const clear = Math.max(layer.clearSpaceMm, placed.zone?.clearSpaceMm ?? 0);
  const knock = layer.knockOut ? [growRing(ring, clear, "miter")] : [];
  return { built, knock, issues: [...issues, ...report.issues], colours, dpis, marks: [report.mark] };
}
