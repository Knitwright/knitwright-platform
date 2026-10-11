import { chain, closedCommands, curveTo, pt } from "../../chain";
import { need, resolveDimensions } from "../../dimensions";
import { placedDecoration } from "../../artwork";
import { tidyCommands } from "../../paths";
import type { Point } from "../../model";
import { calloutsFrom, type DrawContext, type FamilyDrawing } from "../drawing";
import { readBottomsOptions } from "./options";
import { bottomsAnchor, bottomsCalloutEnds, bottomsDetails, bottomsPanels, bottomsSeams, bottomsStitching } from "./parts";
import { bottomsProportions } from "./proportions";
import { bottomsBasisOf, bottomsFitProblems, bottomsSilhouette, type BottomsBasis } from "./shape";

const rounded = (point: Point): Point => ({ x: Math.round(point.x * 10) / 10 + 0, y: Math.round(point.y * 10) / 10 + 0 });

/** The opening at the top of the waistband, as a thin closed shape inside the band. */
function waistOpening(basis: BottomsBasis) {
  const { waistHalf, bandHeight } = basis;
  const depth = bandHeight * 0.3;
  return chain(
    pt(-waistHalf, 0),
    curveTo(pt(-waistHalf * 0.5, depth), pt(waistHalf * 0.5, depth), pt(waistHalf, 0)),
    curveTo(pt(waistHalf * 0.5, depth * 0.35), pt(-waistHalf * 0.5, depth * 0.35), pt(-waistHalf, 0)),
  );
}

function landmarksOf(basis: BottomsBasis): Readonly<Record<string, Point>> {
  return {
    "waist-centre": rounded(pt(0, 0)),
    "waist-right": rounded(pt(basis.waistHalf, 0)),
    "hip-right": rounded(pt(basis.hipHalf, basis.hipY)),
    crotch: rounded(pt(0, basis.crotchY)),
    "hem-outside-right": rounded(pt(basis.hemOuter, basis.hemY)),
    "hem-inside-right": rounded(pt(basis.hemInner, basis.hemY)),
  };
}

/**
 * Draws one side of shorts, joggers, leggings or track pants. The same rules as for tops:
 * one scale on both axes, measurements drive the drawing, and any that are missing come from
 * the proportions, which makes the drawing not to scale.
 */
export function drawBottoms(context: DrawContext): FamilyDrawing | null {
  const options = readBottomsOptions(context.spec);
  const resolved = resolveDimensions({
    needed: context.points.map((point) => ({ id: point.id, label: point.label })),
    values: context.values,
    proportions: bottomsProportions(options),
    check: (dims) => bottomsFitProblems(dims, options),
  });
  const { basis } = bottomsBasisOf(resolved.dims, options);
  if (!basis) return null;
  const { view } = context;
  const callouts =
    context.callouts && resolved.toScale
      ? calloutsFrom(context.points, (id) => need(resolved.dims, id), (id) => bottomsCalloutEnds(view, basis, id))
      : null;
  return {
    resolved,
    panels: bottomsPanels(context, basis, options),
    seams: bottomsSeams(view, basis, options),
    stitching: bottomsStitching(basis, options),
    details: bottomsDetails(view, basis, options),
    artwork: placedDecoration(context.spec, view, (panelId, anchorId) => bottomsAnchor(view, basis, panelId, anchorId)),
    callouts,
    outline: { silhouette: tidyCommands(closedCommands(bottomsSilhouette(basis))), neck: tidyCommands(closedCommands(waistOpening(basis))) },
    landmarks: landmarksOf(basis),
  };
}
