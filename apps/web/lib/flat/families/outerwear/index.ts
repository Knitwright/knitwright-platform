import { closedCommands, pt } from "../../chain";
import { need, resolveDimensions } from "../../dimensions";
import { placedDecoration } from "../../artwork";
import type { Point } from "../../model";
import { tidyCommands } from "../../paths";
import { anchorPoint } from "../../templates/anchors";
import { calloutElements } from "../../templates/callouts";
import { outlineOf } from "../../templates/outline";
import { sleeveEnds } from "../../templates/pieces";
import { calloutsFrom, type DrawContext, type FamilyDrawing } from "../drawing";
import { readOuterwearOptions } from "./options";
import { hoodCrown, outerwearCalloutEnds, outerwearDetails, outerwearPanels, outerwearSeams, outerwearStitching } from "./parts";
import { outerwearProportions } from "./proportions";
import { faceOpening, hoodedSilhouette, outerwearFitProblems, outerwearShapeOf, type OuterwearShape } from "./shape";

const rounded = (point: Point): Point => ({ x: Math.round(point.x * 10) / 10 + 0, y: Math.round(point.y * 10) / 10 + 0 });

/** The points the tops drawing code already knows how to show. */
const TOPS_POINTS = new Set([
  "chest-width",
  "body-length",
  "shoulder-width",
  "sleeve-length",
  "armhole",
  "upper-arm",
  "sleeve-opening",
  "hem-width",
  "neck-width",
  "front-neck-drop",
  "back-neck-drop",
  "collar-height",
]);

function landmarksOf(shape: OuterwearShape): Readonly<Record<string, Point>> {
  const { basis } = shape.frame;
  return {
    hps: pt(0, 0),
    "underarm-right": rounded(basis.underarm),
    "sleeve-end-right": rounded(sleeveEnds(basis).topEnd),
    "hem-centre": rounded(pt(0, basis.length)),
    ...(shape.options.hood !== "none" ? { "hood-crown": rounded(hoodCrown(shape)) } : {}),
    ...(shape.options.fullZip ? { "zip-top": rounded(pt(0, shape.zipTop)) } : {}),
  };
}

function outlineFor(shape: OuterwearShape): FamilyDrawing["outline"] {
  if (shape.options.hood === "none") return outlineOf(shape.frame);
  return {
    silhouette: tidyCommands(closedCommands(hoodedSilhouette(shape))),
    neck: tidyCommands(closedCommands(faceOpening(shape))),
  };
}

/**
 * Draws one side of a pullover hoodie, zip hoodie or track jacket. The body, sleeves, neck
 * and collar are drawn by the tops code, so a hoodie and a tee are drawn the same way. The
 * hood, zip, pockets and rib bands are added here.
 */
export function drawOuterwear(context: DrawContext): FamilyDrawing | null {
  const options = readOuterwearOptions(context.spec);
  const resolved = resolveDimensions({
    needed: context.points.map((point) => ({ id: point.id, label: point.label })),
    values: context.values,
    proportions: outerwearProportions(options),
    check: (dims) => outerwearFitProblems(dims, options),
  });
  const { shape } = outerwearShapeOf(resolved.dims, options, context.view);
  if (!shape) return null;
  const value = (id: string): number => need(resolved.dims, id);
  const topsPoints = context.points.filter((point) => TOPS_POINTS.has(point.id));
  const ownPoints = context.points.filter((point) => !TOPS_POINTS.has(point.id));
  const callouts =
    context.callouts && resolved.toScale
      ? [
          ...calloutElements(topsPoints.map((point) => ({ id: point.id, label: point.label, value: value(point.id) })), shape.frame, resolved.dims),
          ...calloutsFrom(ownPoints, value, (id) => outerwearCalloutEnds(shape, id)),
        ]
      : null;
  return {
    resolved,
    panels: outerwearPanels(context, shape),
    seams: outerwearSeams(shape),
    stitching: outerwearStitching(shape),
    details: outerwearDetails(shape),
    artwork: placedDecoration(context.spec, context.view, (panelId, anchorId) => anchorPoint(shape.frame, panelId, anchorId)),
    callouts,
    outline: outlineFor(shape),
    landmarks: landmarksOf(shape),
  };
}
