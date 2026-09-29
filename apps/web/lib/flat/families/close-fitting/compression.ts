import { chain, closedCommands, lineTo, mirrorChain, openCommands, pt } from "../../chain";
import { darken } from "../../colour";
import { need, type Dims } from "../../dimensions";
import type { FlatElement, FlatPath, Point, View } from "../../model";
import { insidePath, panelPath, stitchPath } from "../../paths";
import { anchorPoint } from "../../templates/anchors";
import { basisOf } from "../../templates/basis";
import { calloutElements } from "../../templates/callouts";
import { neckbandChain } from "../../templates/collar";
import { insideBackChain } from "../../templates/inside-back";
import { seamLines, stitchLines } from "../../templates/lines";
import { outlineOf } from "../../templates/outline";
import { bodyOutline, frameOf, sleeveChains, sleeveEnds, type Frame } from "../../templates/pieces";
import type { DrawContext, FamilyDrawing } from "../drawing";
import { asTopsOptions, type CloseFitOptions } from "./options";

const INSIDE_TONE = 0.86;
const FLAT_SEAM_GAP = 0.008;

/** The frame of a compression top: a top with a round neck and set-in sleeves. */
export function compressionFrame(dims: Dims, options: CloseFitOptions, view: View): { frame: Frame | null; problems: readonly string[] } {
  const tops = asTopsOptions(options);
  const { basis, problems } = basisOf(dims, tops);
  return basis ? { frame: frameOf(basis, tops, view, dims), problems } : { frame: null, problems };
}

function panels(context: DrawContext, frame: Frame, options: CloseFitOptions): FlatPath[] {
  const bodyId = `body-${context.view}`;
  const { sleeve } = sleeveChains(frame, 0);
  const onRight = sleeve;
  const onLeft = mirrorChain(sleeve);
  const [left, right] = context.view === "front" ? [onRight, onLeft] : [onLeft, onRight];
  const pieces: [string, FlatPath["commands"] | null][] = [
    [bodyId, closedCommands(bodyOutline(frame))],
    ["sleeve-left", closedCommands(left)],
    ["sleeve-right", closedCommands(right)],
    ["binding", options.edge === "bound" ? closedCommands(neckbandChain(frame)) : null],
  ];
  const drawn = pieces.flatMap(([panelId, commands]) =>
    commands && context.wanted(panelId) ? [panelPath(context.nameOf(panelId), panelId, commands, context.fillOf(panelId))] : [],
  );
  // A turned edge is part of the body: the band round the neck is drawn in the body colour.
  const turned = options.edge !== "bound" ? [insidePath("Turned neck edge", closedCommands(neckbandChain(frame)), context.fillOf(bodyId))] : [];
  const inside = insideBackChain(frame);
  const through = inside ? [insidePath("Inside of the neck", closedCommands(inside), darken(context.fillOf(bodyId), INSIDE_TONE))] : [];
  return [...through, ...drawn, ...turned];
}

/** Stitching both sides of the side seams, where the seams are flat. */
function flatSeamStitching(frame: Frame): FlatPath[] {
  const { basis } = frame;
  const gap = FLAT_SEAM_GAP * basis.chest;
  // The side seam is the edge of the flat, so both rows of a flat seam show just inside it.
  return ([["outer", -gap], ["inner", -gap * 2.5]] as const).flatMap(([row, offset]) => {
    const line = chain(pt(basis.underarm.x + offset, basis.underarm.y), lineTo(pt(basis.halfHem + offset, basis.length)));
    const name = `Flat seam stitching, ${row} row`;
    return [stitchPath(`${name}, right`, openCommands(line)), stitchPath(`${name}, left`, openCommands(mirrorChain(line)))];
  });
}

const rounded = (point: Point): Point => ({ x: Math.round(point.x * 10) / 10 + 0, y: Math.round(point.y * 10) / 10 + 0 });

/** A compression top drawn as a close-fitting tee, with its binding and flat seams. */
export function drawCompression(context: DrawContext, frame: Frame, options: CloseFitOptions, resolved: FamilyDrawing["resolved"]): FamilyDrawing {
  const value = (id: string): number => need(resolved.dims, id);
  const callouts: readonly FlatElement[] | null =
    context.callouts && resolved.toScale
      ? calloutElements(context.points.map((point) => ({ id: point.id, label: point.label, value: value(point.id) })), frame, resolved.dims)
      : null;
  return {
    resolved,
    panels: panels(context, frame, options),
    seams: seamLines(frame).map((line) => (line.name === "Neckband seam" ? { ...line, name: options.edge === "bound" ? "Binding seam" : "Neck edge" } : line)),
    stitching: [...stitchLines(frame), ...(options.flatSeams ? flatSeamStitching(frame) : [])],
    details: [],
    artwork: [],
    callouts,
    outline: outlineOf(frame),
    landmarks: {
      hps: pt(0, 0),
      "underarm-right": rounded(frame.basis.underarm),
      "sleeve-end-right": rounded(sleeveEnds(frame.basis).topEnd),
      "hem-centre": rounded(pt(0, frame.basis.length)),
    },
  };
}

export const compressionAnchor = (frame: Frame, panelId: string, anchorId: string): Point | null => anchorPoint(frame, panelId, anchorId);
