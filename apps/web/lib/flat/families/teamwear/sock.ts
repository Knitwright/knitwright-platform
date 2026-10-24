import { chain, closedCommands, curveTo, joinChains, lineTo, mirrorChain, openCommands, pt, reverseChain, type Chain } from "../../chain";
import { need, resolveDimensions, type Dims, type Proportions } from "../../dimensions";
import { placedDecoration } from "../../artwork";
import type { FlatPath, Point, View } from "../../model";
import { panelPath, seamPath, stitchPath, tidyCommands } from "../../paths";
import { calloutsFrom, chosen, type DrawContext, type Ends, type FamilyDrawing } from "../drawing";

/**
 * A sock drawn flat as a straight, symmetrical schematic: the leg, then the foot in line with
 * it, so the drawing is one shape about the centre line like every other flat. A worn sock
 * bends at the heel; this drawing does not, and says nothing about the heel or toe shape,
 * which are the sock factory's knitting programme (OWNER-QUESTIONS.md). Both views are alike.
 */

type SockHeight = "knee-high" | "crew";

/** Where the widest and narrowest parts of the leg sit, as shares of the leg height. */
const CALF_AT = 0.3;
const ANKLE_AT = 0.85;
/** The foot is drawn this much wider than the ankle, and the band is this share of the leg. */
const FOOT_WIDTH_OVER_ANKLE = 1.3;
const BAND_SHARE = 0.12;
const SHIN_AT = 0.45;
const TOE_ROUND = 0.25;
const KAPPA = 0.5522847498;

/** Ratios against the calf width. A designer's starting shape, not the measurements of any sock. */
export const sockProportions = (height: SockHeight): Proportions => ({
  "foot-length": 1.9,
  "leg-height": height === "knee-high" ? 3.4 : 2,
  "calf-width": 1,
  "ankle-width": 0.7,
  "top-width": 0.92,
});

export const readSockHeight = (spec: Pick<DrawContext["spec"], "options">): SockHeight => (chosen(spec, "sock-height") === "crew" ? "crew" : "knee-high");

const SHAPE = "The sock's measurements do not fit together: check the foot, leg and widths.";

/** Plain ranges against the calf width inside which the drawing keeps its shape. */
function sockProblems(dims: Dims): readonly string[] {
  const calf = need(dims, "calf-width");
  const share = (id: string): number => need(dims, id) / calf;
  const ok =
    share("foot-length") >= 1.2 && share("foot-length") <= 4 &&
    share("leg-height") >= 0.5 && share("leg-height") <= 6 &&
    share("ankle-width") >= 0.4 && share("ankle-width") <= 1.2 &&
    share("top-width") >= 0.5 && share("top-width") <= 1.5;
  return ok ? [] : [SHAPE];
}

interface SockShape {
  readonly topHalf: number;
  readonly calfHalf: number;
  readonly ankleHalf: number;
  readonly footHalf: number;
  readonly legHeight: number;
  readonly footLength: number;
  readonly calf: number;
}

const shapeOf = (dims: Dims): SockShape => ({
  topHalf: need(dims, "top-width") / 2,
  calfHalf: need(dims, "calf-width") / 2,
  ankleHalf: need(dims, "ankle-width") / 2,
  footHalf: (need(dims, "ankle-width") * FOOT_WIDTH_OVER_ANKLE) / 2,
  legHeight: need(dims, "leg-height"),
  footLength: need(dims, "foot-length"),
  calf: need(dims, "calf-width"),
});

/** The right edge of the leg from the top edge down to the heel line. */
const legEdge = (s: SockShape): Chain =>
  chain(pt(s.topHalf, 0), lineTo(pt(s.calfHalf, CALF_AT * s.legHeight)), lineTo(pt(s.ankleHalf, ANKLE_AT * s.legHeight)), lineTo(pt(s.ankleHalf, s.legHeight)));

/** The right edge of the foot from the heel line round the toe to the centre line. */
function footEdge(s: SockShape): Chain {
  const y0 = s.legHeight;
  const round = TOE_ROUND * s.footLength;
  const start = y0 + s.footLength - round;
  return chain(
    pt(s.ankleHalf, y0),
    lineTo(pt(s.footHalf, y0 + 0.35 * s.footLength)),
    lineTo(pt(s.footHalf, start)),
    curveTo(pt(s.footHalf, start + round * KAPPA), pt(s.footHalf * KAPPA, start + round), pt(0, start + round)),
  );
}

const bothSides = (right: Chain): Chain => joinChains(right, reverseChain(mirrorChain(right)));

/** The leg and foot as one outline, from the top centre round the whole sock. */
function silhouette(s: SockShape): Chain {
  const leg = legEdge(s);
  const foot = footEdge(s);
  return bothSides(chain(pt(0, 0), lineTo(leg.start), ...leg.pieces, ...foot.pieces));
}

const bandBottomHalf = (s: SockShape): number => s.topHalf + (s.calfHalf - s.topHalf) * ((BAND_SHARE * s.legHeight) / (CALF_AT * s.legHeight));

function panels(context: DrawContext, s: SockShape, band: boolean): FlatPath[] {
  const bandY = BAND_SHARE * s.legHeight;
  const bandHalf = bandBottomHalf(s);
  const legStart = band ? bandY : 0;
  const legStartHalf = band ? bandHalf : s.topHalf;
  const legRight = chain(pt(legStartHalf, legStart), lineTo(pt(s.calfHalf, CALF_AT * s.legHeight)), lineTo(pt(s.ankleHalf, ANKLE_AT * s.legHeight)), lineTo(pt(s.ankleHalf, s.legHeight)));
  const leg = joinChains(chain(pt(-legStartHalf, legStart), lineTo(pt(legStartHalf, legStart))), legRight, reverseChain(mirrorChain(legRight)));
  const bandShape = chain(pt(-s.topHalf, 0), lineTo(pt(s.topHalf, 0)), lineTo(pt(bandHalf, bandY)), lineTo(pt(-bandHalf, bandY)));
  const footRight = footEdge(s);
  const foot = joinChains(chain(pt(-s.ankleHalf, s.legHeight), lineTo(pt(s.ankleHalf, s.legHeight))), footRight, reverseChain(mirrorChain(footRight)));
  const pieces: [string, Chain | null][] = [
    ["sock-leg", leg],
    ["sock-top-band", band ? bandShape : null],
    ["sock-foot", foot],
  ];
  return pieces.flatMap(([id, shape]) =>
    shape && context.wanted(id) ? [panelPath(context.nameOf(id), id, closedCommands(shape), context.fillOf(id))] : [],
  );
}

function seams(s: SockShape, band: boolean): FlatPath[] {
  const join = seamPath("Leg and foot join", openCommands(chain(pt(-s.ankleHalf, s.legHeight), lineTo(pt(s.ankleHalf, s.legHeight)))));
  if (!band) return [join];
  const y = BAND_SHARE * s.legHeight;
  const half = bandBottomHalf(s);
  return [seamPath("Top band join", openCommands(chain(pt(-half, y), lineTo(pt(half, y))))), join];
}

function stitching(s: SockShape, band: boolean): FlatPath[] {
  if (band) return [];
  const y = 0.05 * s.legHeight;
  const half = s.topHalf + (s.calfHalf - s.topHalf) * (y / (CALF_AT * s.legHeight));
  return [stitchPath("Top edge stitching", openCommands(chain(pt(-half, y), lineTo(pt(half, y)))))];
}

/** The mouth of the sock: a thin loop across the top edge. */
function mouth(s: SockShape) {
  const depth = 0.08 * s.topHalf * 2;
  const a = s.topHalf;
  return chain(pt(-a, 0), curveTo(pt(-a / 2, depth), pt(a / 2, depth), pt(a, 0)), curveTo(pt(a / 2, depth * 0.35), pt(-a / 2, depth * 0.35), pt(-a, 0)));
}

const calloutEnds = (s: SockShape, pointId: string): Ends | null => {
  const gap = 0.12 * s.calf;
  const table: Readonly<Record<string, Ends>> = {
    "foot-length": [pt(s.footHalf + gap, s.legHeight), pt(s.footHalf + gap, s.legHeight + s.footLength)],
    "leg-height": [pt(-s.topHalf - gap, 0), pt(-s.topHalf - gap, s.legHeight)],
    "calf-width": [pt(-s.calfHalf, CALF_AT * s.legHeight), pt(s.calfHalf, CALF_AT * s.legHeight)],
    "ankle-width": [pt(-s.ankleHalf, ANKLE_AT * s.legHeight), pt(s.ankleHalf, ANKLE_AT * s.legHeight)],
    "top-width": [pt(-s.topHalf, -gap), pt(s.topHalf, -gap)],
  };
  return table[pointId] ?? null;
};

/** The shin is on the front of the sock and the calf on the back. */
const anchorFor = (view: View, s: SockShape, panelId: string, anchorId: string): Point | null => {
  if (panelId !== "sock-leg") return null;
  const at = pt(0, SHIN_AT * s.legHeight);
  if (anchorId === "shin") return view === "front" ? at : null;
  return anchorId === "calf" && view === "back" ? at : null;
};

export function drawSock(context: DrawContext): FamilyDrawing | null {
  const resolved = resolveDimensions({
    needed: context.points.map((point) => ({ id: point.id, label: point.label })),
    values: context.values,
    proportions: sockProportions(readSockHeight(context.spec)),
    check: sockProblems,
  });
  const s = shapeOf(resolved.dims);
  const band = chosen(context.spec, "sock-top") === "contrast-band";
  const callouts =
    context.callouts && resolved.toScale ? calloutsFrom(context.points, (id) => need(resolved.dims, id), (id) => calloutEnds(s, id)) : null;
  return {
    resolved,
    panels: panels(context, s, band),
    seams: seams(s, band),
    stitching: stitching(s, band),
    details: [] as FlatPath[],
    artwork: placedDecoration(context.spec, context.view, (panelId, anchorId) => anchorFor(context.view, s, panelId, anchorId)),
    callouts,
    outline: { silhouette: tidyCommands(closedCommands(silhouette(s))), neck: tidyCommands(closedCommands(mouth(s))) },
    landmarks: { "top-centre": pt(0, 0), "heel-centre": pt(0, s.legHeight), "toe-tip": pt(0, s.legHeight + s.footLength) },
  };
}
