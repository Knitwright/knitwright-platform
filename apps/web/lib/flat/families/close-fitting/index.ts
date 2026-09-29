import { closedCommands, pt } from "../../chain";
import { need, resolveDimensions, type Dims } from "../../dimensions";
import { placedArtwork } from "../../artwork";
import type { Point } from "../../model";
import { tidyCommands } from "../../paths";
import { calloutsFrom, type DrawContext, type FamilyDrawing } from "../drawing";
import { compressionAnchor, compressionFrame, drawCompression } from "./compression";
import { readCloseFitOptions, type CloseFitOptions } from "./options";
import { closeFitProportions } from "./proportions";
import { neckLoop, sleevelessOutline, sleevelessShapeOf } from "./sleeveless";
import { sleevelessAnchor, sleevelessCalloutEnds, sleevelessPanels, sleevelessSeams, sleevelessStitching } from "./sleeveless-parts";

const rounded = (point: Point): Point => ({ x: Math.round(point.x * 10) / 10 + 0, y: Math.round(point.y * 10) / 10 + 0 });

/** Every problem with a set of dimensions, checked on both views, since the back has its own shape. */
export function closeFitProblems(dims: Dims, options: CloseFitOptions): readonly string[] {
  if (options.kind === "compression-top") return compressionFrame(dims, options, "front").problems;
  return [...new Set([...sleevelessShapeOf(dims, options, "front").problems, ...sleevelessShapeOf(dims, options, "back").problems])];
}

/**
 * Draws one side of a singlet, vest, sports bra or compression top. A compression top is a
 * close-fitting tee and is drawn by the tops code. The others have no sleeves: straps, deep
 * armholes, a racerback where chosen, and the underband of a sports bra.
 */
export function drawCloseFitting(context: DrawContext): FamilyDrawing | null {
  const options = readCloseFitOptions(context.spec);
  const resolved = resolveDimensions({
    needed: context.points.map((point) => ({ id: point.id, label: point.label })),
    values: context.values,
    proportions: closeFitProportions(options),
    check: (dims) => closeFitProblems(dims, options),
  });
  const { view } = context;
  if (options.kind === "compression-top") {
    const { frame } = compressionFrame(resolved.dims, options, view);
    if (!frame) return null;
    const drawing = drawCompression(context, frame, options, resolved);
    const artwork = placedArtwork(context.spec.artwork, view, (panelId, anchorId) => compressionAnchor(frame, panelId, anchorId));
    return { ...drawing, artwork };
  }
  const { shape } = sleevelessShapeOf(resolved.dims, options, view);
  if (!shape) return null;
  const callouts =
    context.callouts && resolved.toScale
      ? calloutsFrom(context.points, (id) => need(resolved.dims, id), (id) => sleevelessCalloutEnds(shape, id))
      : null;
  return {
    resolved,
    panels: sleevelessPanels(context, shape),
    seams: sleevelessSeams(shape),
    stitching: sleevelessStitching(shape),
    details: [],
    artwork: placedArtwork(context.spec.artwork, view, (panelId, anchorId) => sleevelessAnchor(shape, panelId, anchorId)),
    callouts,
    outline: { silhouette: tidyCommands(closedCommands(sleevelessOutline(shape))), neck: tidyCommands(closedCommands(neckLoop(shape))) },
    landmarks: {
      hps: rounded(pt(shape.neckHalf, 0)),
      "strap-top-right": rounded(shape.strapTop),
      "underarm-right": rounded(shape.underarm),
      "hem-centre": rounded(pt(0, shape.length)),
      ...(shape.narrow ? { "back-narrowest-right": rounded(shape.narrow) } : {}),
    },
  };
}
