import { chain, closedCommands, curveTo, joinChains, lineTo, mirrorChain, openCommands, pt, reverseChain, type Chain } from "../../chain";
import { need, resolveDimensions, type Dims, type Proportions } from "../../dimensions";
import { placedDecoration } from "../../artwork";
import type { FlatPath, Point, View } from "../../model";
import { detailPath, panelPath, seamPath, stitchPath, tidyCommands } from "../../paths";
import { calloutsFrom, chosen, type DrawContext, type Ends, type FamilyDrawing } from "../drawing";

/**
 * A cap drawn from the front: the crown, the head band under it and the peak below. Both views
 * are drawn alike, because the drawing code and its checks treat every panel of a design as
 * present in both views; only the artwork differs. The shapes are Knitwright proportions, not
 * a cap maker's block (OWNER-QUESTIONS.md).
 */

type CapShape = "peaked" | "baggy";

/** The head band is this share of the crown height, and a baggy crown is this much wider than the band. */
const BAND_SHARE = 0.14;
const BAGGY_BULGE = 1.2;

/** Ratios against the head opening width. A designer's starting shape, not the measurements of any cap. */
export const capProportions = (shape: CapShape): Proportions => ({
  "head-width": 1,
  "crown-height": shape === "baggy" ? 0.7 : 0.62,
  "peak-length": shape === "baggy" ? 0.3 : 0.34,
  "peak-width": 0.8,
});

export const readCapShape = (spec: Pick<DrawContext["spec"], "options">): CapShape => (chosen(spec, "cap-shape") === "baggy-cap" ? "baggy" : "peaked");

const SHAPE = "The cap's measurements do not fit together: check the crown, peak and head opening.";

function capProblems(dims: Dims): readonly string[] {
  const head = need(dims, "head-width");
  const share = (id: string): number => need(dims, id) / head;
  const ok =
    share("crown-height") >= 0.3 && share("crown-height") <= 1.1 &&
    share("peak-length") >= 0.08 && share("peak-length") <= 0.8 &&
    share("peak-width") >= 0.4 && share("peak-width") <= 1.6;
  return ok ? [] : [SHAPE];
}

interface Cap {
  readonly half: number;
  readonly bulge: number;
  readonly crownHeight: number;
  readonly bandTop: number;
  readonly peakHalf: number;
  readonly peakLength: number;
  readonly head: number;
}

function capOf(dims: Dims, shape: CapShape): Cap {
  const head = need(dims, "head-width");
  const crownHeight = need(dims, "crown-height");
  return {
    half: head / 2,
    bulge: (head / 2) * (shape === "baggy" ? BAGGY_BULGE : 1),
    crownHeight,
    bandTop: crownHeight * (1 - BAND_SHARE),
    peakHalf: need(dims, "peak-width") / 2,
    peakLength: need(dims, "peak-length"),
    head,
  };
}

/** The right side of the crown from the top centre down to the bottom of the head band. */
function crownEdge(c: Cap, shape: CapShape): Chain {
  const { half, bulge, bandTop } = c;
  const dome =
    shape === "baggy"
      ? [curveTo(pt(0.45 * bulge, 0), pt(bulge, 0.12 * bandTop), pt(bulge, 0.45 * bandTop)), curveTo(pt(bulge, 0.75 * bandTop), pt(half * 1.05, 0.92 * bandTop), pt(half, bandTop))]
      : [curveTo(pt(0.6 * half, 0), pt(half, 0.2 * bandTop), pt(half, 0.62 * bandTop)), lineTo(pt(half, bandTop))];
  return chain(pt(0, 0), ...dome, lineTo(pt(half, c.crownHeight)));
}

/** The right side of the peak from the head band edge round to the centre front. */
const peakEdge = (c: Cap): Chain =>
  chain(pt(c.half, c.crownHeight), curveTo(pt(c.peakHalf, c.crownHeight + 0.1 * c.peakLength), pt(0.35 * c.peakHalf, c.crownHeight + c.peakLength), pt(0, c.crownHeight + c.peakLength)));

const bothSides = (right: Chain): Chain => joinChains(right, reverseChain(mirrorChain(right)));

function panels(context: DrawContext, c: Cap, shape: CapShape): FlatPath[] {
  const crownRight = crownEdge(c, shape);
  // The crown ends where the head band starts, so its last line stops at the band top.
  const crown = bothSides(chain(crownRight.start, ...crownRight.pieces.slice(0, -1)));
  const peak = joinChains(chain(pt(-c.half, c.crownHeight), lineTo(pt(c.half, c.crownHeight))), peakEdge(c), reverseChain(mirrorChain(peakEdge(c))));
  const band = chain(pt(-c.half, c.bandTop), lineTo(pt(c.half, c.bandTop)), lineTo(pt(c.half, c.crownHeight)), lineTo(pt(-c.half, c.crownHeight)));
  const pieces: [string, Chain][] = [["cap-crown", crown], ["cap-band", band], ["cap-peak", peak]];
  return pieces.flatMap(([id, shapeOf]) => (context.wanted(id) ? [panelPath(context.nameOf(id), id, closedCommands(shapeOf), context.fillOf(id))] : []));
}

function seams(c: Cap, view: View): FlatPath[] {
  const across = (name: string, y: number): FlatPath => seamPath(name, openCommands(chain(pt(-c.half, y), lineTo(pt(c.half, y)))));
  const centre = seamPath("Crown seam", openCommands(chain(pt(0, 0), lineTo(pt(0, c.bandTop)))));
  return [across("Head band seam", c.bandTop), across("Peak seam", c.crownHeight), ...(view === "front" ? [centre] : [])];
}

const stitching = (c: Cap): FlatPath[] => {
  const y = c.crownHeight + 0.14 * c.peakLength;
  const half = c.half + (c.peakHalf - c.half) * 0.55;
  return [stitchPath("Peak edge stitching", openCommands(chain(pt(-half, y), lineTo(pt(half, y)))))];
};

/** The strap across the back of the head band, seen only from behind. */
function details(c: Cap, view: View, strap: boolean): FlatPath[] {
  if (!strap || view !== "back") return [];
  const height = c.crownHeight - c.bandTop;
  const half = 0.16 * c.head;
  const top = c.bandTop + 0.2 * height;
  return [detailPath("Back strap", closedCommands(chain(pt(-half, top), lineTo(pt(half, top)), lineTo(pt(half, top + 0.6 * height)), lineTo(pt(-half, top + 0.6 * height)))))];
}

/** The head opening: a thin loop along the bottom of the head band. */
function opening(c: Cap) {
  const a = c.half;
  const y = c.crownHeight;
  const depth = 0.1 * c.head;
  return chain(pt(-a, y), curveTo(pt(-a / 2, y + depth), pt(a / 2, y + depth), pt(a, y)), curveTo(pt(a / 2, y + depth * 0.3), pt(-a / 2, y + depth * 0.3), pt(-a, y)));
}

const calloutEnds = (c: Cap, pointId: string): Ends | null => {
  const gap = 0.08 * c.head;
  const table: Readonly<Record<string, Ends>> = {
    "head-width": [pt(-c.half, c.bandTop), pt(c.half, c.bandTop)],
    "crown-height": [pt(-c.bulge - gap, 0), pt(-c.bulge - gap, c.crownHeight)],
    "peak-length": [pt(c.peakHalf + gap, c.crownHeight), pt(c.peakHalf + gap, c.crownHeight + c.peakLength)],
    "peak-width": [pt(-c.peakHalf, c.crownHeight + 0.5 * c.peakLength), pt(c.peakHalf, c.crownHeight + 0.5 * c.peakLength)],
  };
  return table[pointId] ?? null;
};

/** Front artwork sits high on the front of the crown and back artwork on the back, one in each view. */
const anchorFor = (view: View, c: Cap, panelId: string, anchorId: string): Point | null => {
  if (panelId !== "cap-crown") return null;
  const at = pt(0, 0.45 * c.bandTop);
  if (anchorId === "crown-front") return view === "front" ? at : null;
  return anchorId === "crown-back" && view === "back" ? at : null;
};

export function drawCap(context: DrawContext): FamilyDrawing | null {
  const shape = readCapShape(context.spec);
  const resolved = resolveDimensions({
    needed: context.points.map((point) => ({ id: point.id, label: point.label })),
    values: context.values,
    proportions: capProportions(shape),
    check: capProblems,
  });
  const c = capOf(resolved.dims, shape);
  const callouts =
    context.callouts && resolved.toScale ? calloutsFrom(context.points, (id) => need(resolved.dims, id), (id) => calloutEnds(c, id)) : null;
  const crownRight = crownEdge(c, shape);
  const outer = bothSides(chain(crownRight.start, ...crownRight.pieces, ...peakEdge(c).pieces));
  return {
    resolved,
    panels: panels(context, c, shape),
    seams: seams(c, context.view),
    stitching: stitching(c),
    details: details(c, context.view, chosen(context.spec, "cap-adjuster") === "back-strap"),
    artwork: placedDecoration(context.spec, context.view, (panelId, anchorId) => anchorFor(context.view, c, panelId, anchorId)),
    callouts,
    outline: { silhouette: tidyCommands(closedCommands(outer)), neck: tidyCommands(closedCommands(opening(c))) },
    landmarks: { "crown-top": pt(0, 0), "band-bottom-centre": pt(0, c.crownHeight), "peak-tip": pt(0, c.crownHeight + c.peakLength) },
  };
}
