import { chain, curveTo, joinChains, lineTo, mirrorChain, pt, reverseChain, shiftChain, type Chain } from "../../chain";
import { need, type Dims } from "../../dimensions";
import type { Point } from "../../model";
import type { BottomsOptions } from "./options";

/** Shares of the hip width for parts of the drawing that have no point of measure. */
export const CUFF_HEIGHT = 0.1;
export const STRIPE_WIDTH = 0.045;
export const LEG_GAP = 0.025;
export const GUSSET_SIZE = 0.07;
/** The crotch sits a little above the length of the front rise, which is measured along its curve. */
const CROTCH_SHARE = 0.93;
/** The hip line, as a share of the depth from under the waistband to the crotch. */
const HIP_SHARE = 0.85;
const OUTSEAM_TOLERANCE = 0.08;
/** The share of the flat thigh that the front of the leg shows at the crotch. */
const FRONT_THIGH_SHARE = 0.92;

/**
 * Where everything on a pair of bottoms is, on the right half. y runs down from the top of
 * the waistband. The two legs meet at the crotch on the centre line.
 */
export interface BottomsBasis {
  readonly hip: number;
  readonly waistHalf: number;
  readonly stretchedHalf: number;
  readonly bandHeight: number;
  /** Half the width at the seam under the waistband. */
  readonly bandBottomHalf: number;
  readonly hipHalf: number;
  readonly hipY: number;
  readonly crotchY: number;
  readonly thigh: number;
  /**
   * How far out the side is at the crotch. The front view shows the front of the leg, which
   * is a little narrower than the thigh measured flat, since that takes in the back too.
   */
  readonly thighOuter: number;
  readonly hemY: number;
  readonly inseam: number;
  /** The knee, when the leg reaches it: its height and the edges of the right leg there. */
  readonly knee: { readonly y: number; readonly inner: number; readonly outer: number } | null;
  readonly hemInner: number;
  readonly hemOuter: number;
  /** Where the leg panel ends: the hem, or the top of a cuff. */
  readonly bottomY: number;
}

export interface BottomsBasisResult {
  readonly basis: BottomsBasis | null;
  readonly problems: readonly string[];
}

const WAIST_WIDER = "The waist is wider than the hip.";
const STRETCH_SMALLER = "The stretched waist is smaller than the relaxed waist.";
const BAND_DEEP = "The waistband is too deep for the rise.";
const THIGH_FIT = "The thigh does not fit the hip.";
const OPENING_WIDE = "The leg opening is wider than the thigh.";
const KNEE_FIT = "The knee is not between the thigh and the leg opening.";
const OUTSEAM_FIT = "The outside leg does not match the rise and the inside leg.";
const BACK_RISE = "The back rise is shorter than the front rise.";

/** Draws nothing. Says whether the measurements can be drawn together, and places everything if so. */
export function bottomsBasisOf(dims: Dims, options: BottomsOptions): BottomsBasisResult {
  const d = (id: string): number => need(dims, id);
  const hip = d("hip");
  const crotchY = d("front-rise") * CROTCH_SHARE;
  const bandHeight = d("waistband-height");
  const hipY = bandHeight + (crotchY - bandHeight) * HIP_SHARE;
  const thigh = d("thigh");
  const opening = d("leg-opening");
  const inseam = d("inseam");
  const hemY = crotchY + inseam;
  const hasKnee = options.legLength !== "short";
  const problems: string[] = [];
  if (d("waist-relaxed") >= hip) problems.push(WAIST_WIDER);
  if (d("waist-stretched") < d("waist-relaxed")) problems.push(STRETCH_SMALLER);
  if (bandHeight >= hipY * 0.8) problems.push(BAND_DEEP);
  if (thigh < 0.35 * hip || thigh > 0.8 * hip) problems.push(THIGH_FIT);
  if (opening > thigh * 1.05) problems.push(OPENING_WIDE);
  if (hasKnee && (d("knee") > thigh || d("knee") < opening * 0.9)) problems.push(KNEE_FIT);
  if (Math.abs(d("outseam") - hemY) > OUTSEAM_TOLERANCE * hemY) problems.push(OUTSEAM_FIT);
  if (d("back-rise") < d("front-rise")) problems.push(BACK_RISE);
  if (problems.length > 0) return { basis: null, problems };
  const waistHalf = d("waist-relaxed") / 2;
  const hipHalf = hip / 2;
  const centreTop = (thigh * FRONT_THIGH_SHARE) / 2;
  const centreHem = Math.max(centreTop, opening / 2 + LEG_GAP * hip);
  const kneeY = crotchY + inseam / 2;
  const kneeCentre = (centreTop + centreHem) / 2;
  const knee = hasKnee ? { y: kneeY, inner: kneeCentre - d("knee") / 2, outer: kneeCentre + d("knee") / 2 } : null;
  const cuff = options.legFinish === "rib-cuff" ? CUFF_HEIGHT * hip : 0;
  return {
    basis: {
      hip,
      waistHalf,
      stretchedHalf: d("waist-stretched") / 2,
      bandHeight,
      bandBottomHalf: waistHalf + (hipHalf - waistHalf) * (bandHeight / hipY),
      hipHalf,
      hipY,
      crotchY,
      thigh,
      thighOuter: thigh * FRONT_THIGH_SHARE,
      hemY,
      inseam,
      knee,
      hemInner: centreHem - opening / 2,
      hemOuter: centreHem + opening / 2,
      bottomY: hemY - cuff,
    },
    problems,
  };
}

export const bottomsFitProblems = (dims: Dims, options: BottomsOptions): readonly string[] =>
  bottomsBasisOf(dims, options).problems;

/** The x of a straight run of points at height y. The run goes down the page. */
function xOnRun(points: readonly Point[], y: number): number {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1] as Point;
    const b = points[index] as Point;
    if (y <= b.y || index === points.length - 1) {
      const share = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.x + (b.x - a.x) * share;
    }
  }
  return points[0]?.x ?? 0;
}

/** The corners of the outside edge of the right leg below the hip, down to the hem. */
function outsideCorners(basis: BottomsBasis): Point[] {
  const knee = basis.knee ? [pt(basis.knee.outer, basis.knee.y)] : [];
  return [pt(basis.hipHalf, basis.hipY), pt(basis.thighOuter, basis.crotchY), ...knee, pt(basis.hemOuter, basis.hemY)];
}

/** The corners of the inside edge of the right leg, from the crotch down to the hem. */
function insideCorners(basis: BottomsBasis): Point[] {
  const knee = basis.knee ? [pt(basis.knee.inner, basis.knee.y)] : [];
  return [pt(0, basis.crotchY), ...knee, pt(basis.hemInner, basis.hemY)];
}

/** Where the outside and the inside of the right leg are at height y, below the crotch. */
export function legEdgesAt(basis: BottomsBasis, y: number): { inner: number; outer: number } {
  return { inner: xOnRun(insideCorners(basis), y), outer: xOnRun(outsideCorners(basis).slice(1), y) };
}

/** Keeps the corners above y, and ends exactly at y. */
function cutAt(points: readonly Point[], y: number): Point[] {
  const kept = points.filter((point) => point.y < y);
  return [...kept, pt(xOnRun(points, y), y)];
}

/** The outside edge of the right leg, from under the waistband down to height `bottom`. */
export function outsideEdge(basis: BottomsBasis, bottom: number): Chain {
  const start = pt(basis.bandBottomHalf, basis.bandHeight);
  const thigh = pt(basis.thighOuter, basis.crotchY);
  const [, , after] = outsideCorners(basis);
  const below = after ?? pt(basis.hemOuter, basis.hemY);
  // One smooth curve from the waistband out over the hip to the crotch, where it leaves in
  // line with the leg below, so the side has no corner and no notch.
  const depth = basis.crotchY - basis.bandHeight;
  const run = Math.hypot(below.x - thigh.x, below.y - thigh.y);
  const reach = depth * 0.45;
  const lead = pt(thigh.x - ((below.x - thigh.x) / run) * reach, thigh.y - ((below.y - thigh.y) / run) * reach);
  const swell = pt(basis.hipHalf + (basis.hipHalf - (start.x + thigh.x) / 2) * 0.35, start.y + depth * 0.3);
  const rest = cutAt(outsideCorners(basis), bottom).slice(2);
  return chain(start, curveTo(swell, lead, thigh), ...rest.map(lineTo));
}

/** The inside edge of the right leg, from height `bottom` up to the crotch. */
export function insideEdgeUp(basis: BottomsBasis, bottom: number): Chain {
  const points = cutAt(insideCorners(basis), bottom).reverse();
  const [first, ...rest] = points;
  return chain(first as Point, ...rest.map(lineTo));
}

/** The right leg from under the waistband round to the crotch, stopping at `bottom`. */
export function rightLeg(basis: BottomsBasis, bottom: number): Chain {
  return joinChains(outsideEdge(basis, bottom), insideEdgeUp(basis, bottom));
}

/** The legs panel: both legs, closed across the seam under the waistband. */
export function legsOutline(basis: BottomsBasis): Chain {
  const right = rightLeg(basis, basis.bottomY);
  return joinChains(right, reverseChain(mirrorChain(right)));
}

/** The waistband: from the top edge down to the seam that joins it to the legs. */
export function waistbandOutline(basis: BottomsBasis): Chain {
  const { waistHalf, bandBottomHalf, bandHeight } = basis;
  return chain(pt(-waistHalf, 0), lineTo(pt(waistHalf, 0)), lineTo(pt(bandBottomHalf, bandHeight)), lineTo(pt(-bandBottomHalf, bandHeight)));
}

/** A cuff on the right leg: from the end of the leg panel down to the hem. */
export function cuffOutline(basis: BottomsBasis): Chain {
  const top = legEdgesAt(basis, basis.bottomY);
  return chain(pt(top.inner, basis.bottomY), lineTo(pt(top.outer, basis.bottomY)), lineTo(pt(basis.hemOuter, basis.hemY)), lineTo(pt(basis.hemInner, basis.hemY)));
}

/** The same chain moved left by a distance. */
const movedLeft = (item: Chain, distance: number): Chain => shiftChain(item, -distance, 0);

/** The inner edge of the stripe on the right leg: where it is sewn to the leg. */
export function stripeSeam(basis: BottomsBasis): Chain {
  return movedLeft(outsideEdge(basis, basis.bottomY), STRIPE_WIDTH * basis.hip);
}

/** The stripe down the outside of the right leg, from under the waistband to the end of the leg panel. */
export function stripeOutline(basis: BottomsBasis): Chain {
  return joinChains(outsideEdge(basis, basis.bottomY), reverseChain(stripeSeam(basis)));
}

/** A small diamond where the legs meet, seen between them from the front. */
export function gussetOutline(basis: BottomsBasis): Chain {
  const size = GUSSET_SIZE * basis.hip;
  const y = basis.crotchY;
  return chain(pt(0, y - 1.6 * size), lineTo(pt(0.55 * size, y - 0.6 * size)), lineTo(pt(0, y)), lineTo(pt(-0.55 * size, y - 0.6 * size)));
}

/** The whole garment as one silhouette: waistband and legs. */
export function bottomsSilhouette(basis: BottomsBasis): Chain {
  const right = joinChains(chain(pt(basis.waistHalf, 0)), rightLeg(basis, basis.hemY));
  return joinChains(right, reverseChain(mirrorChain(right)));
}
