import {
  chain,
  curveTo,
  joinChains,
  lineTo,
  mirrorChain,
  pt,
  quarterDown,
  reverseChain,
  type Chain,
} from "../chain";
import type { Dims } from "../dimensions";
import type { Point, View } from "../model";
import { V_SEAM_FACTOR, type Basis } from "./basis";
import type { TopsOptions } from "./options";

/** How far the armhole curve bows in towards the centre, as a share of the chest. Front is deeper. */
const SCOOP_FRONT = 0.055;
const SCOOP_BACK = 0.035;
const RAGLAN_BOW = 0.03;
/** How far the side of a curved hem rises, as a share of the body length. The back is longer. */
const RISE_FRONT = 0.05;
const RISE_BACK = 0.025;

/** Everything a template needs to draw one side of a top. */
export interface Frame {
  readonly basis: Basis;
  readonly options: TopsOptions;
  readonly view: View;
  /** How far the neck opening drops at the centre, for this view. */
  readonly drop: number;
  readonly collarHeight: number;
  readonly placketLength: number;
  readonly placketWidth: number;
  readonly scoop: number;
  readonly hemRise: number;
}

export function frameOf(basis: Basis, options: TopsOptions, view: View, dims: Dims): Frame {
  const front = view === "front";
  return {
    basis,
    options,
    view,
    drop: dims[front ? "front-neck-drop" : "back-neck-drop"] ?? 0,
    collarHeight: dims["collar-height"] ?? 0,
    placketLength: dims["placket-length"] ?? 0,
    placketWidth: dims["placket-width"] ?? 0,
    scoop: (options.raglan ? RAGLAN_BOW : front ? SCOOP_FRONT : SCOOP_BACK) * basis.chest,
    hemRise: options.hem === "curved" ? (front ? RISE_FRONT : RISE_BACK) * basis.length : 0,
  };
}

/** True when the neck opening is a V. Only the front of a V neck top is. The back is always round. */
export const isV = (frame: Frame): boolean => frame.options.neck === "v" && frame.view === "front";

/** The edge of the neck opening, from the shoulder to the centre, on the right side. */
export function neckOpening(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  return isV(frame) ? chain(pt(a, 0), lineTo(pt(0, frame.drop))) : chain(pt(a, 0), quarterDown(a, frame.drop));
}

/** The seam round the neck opening, on the right side. It lies outside the opening by the band. */
export function neckSeam(frame: Frame): Chain {
  const { seamX, band } = frame.basis;
  if (isV(frame)) return chain(pt(seamX, 0), lineTo(pt(0, frame.drop + band * V_SEAM_FACTOR)));
  return chain(pt(seamX, 0), quarterDown(seamX, frame.drop + band));
}

/** A right side chain made whole: it and its mirror image, right to left. */
export const bothSides = (right: Chain): Chain => joinChains(right, reverseChain(mirrorChain(right)));

const sub = (a: Point, b: Point): Point => pt(a.x - b.x, a.y - b.y);
const add = (a: Point, b: Point, scale: number): Point => pt(a.x + b.x * scale, a.y + b.y * scale);

/** The armhole seam, or the raglan seam, from the top to the underarm on the right side. */
export function armholeChain(frame: Frame): Chain {
  const { top, underarm } = frame.basis;
  const along = sub(underarm, top);
  const length = Math.hypot(along.x, along.y);
  const inward = pt(-along.y / length, along.x / length);
  const [first, second] = frame.options.raglan ? [0.3, 0.7] : [0.16, 0.62];
  const [bowA, bowB] = frame.options.raglan ? [1, 1] : [1.1, 1.35];
  const c1 = add(add(top, along, first), inward, frame.scoop * bowA);
  const c2 = add(add(top, along, second), inward, frame.scoop * bowB);
  return chain(top, curveTo(c1, c2, underarm));
}

/** The height of the hem above the centre of the hem, at a distance x from the centre line. */
export const hemLift = (frame: Frame, x: number): number => frame.hemRise * (x / frame.basis.halfHem) ** 2;

/** The hem from x0 to x1 along a curve that is exact for the parabola the hem follows. */
export function hemSegment(frame: Frame, x0: number, x1: number, raise = 0): Chain {
  const { length, halfHem } = frame.basis;
  const y = (x: number): number => length - hemLift(frame, x) - raise;
  const slope = (x: number): number => (-2 * frame.hemRise * x) / (halfHem * halfHem);
  const step = (x1 - x0) / 3;
  const start = pt(x0, y(x0));
  if (frame.hemRise === 0) return chain(start, lineTo(pt(x1, y(x1))));
  return chain(start, curveTo(pt(x0 + step, y(x0) + slope(x0) * step), pt(x1 - step, y(x1) - slope(x1) * step), pt(x1, y(x1))));
}

/** The right half of the body from the neck to the centre of the hem. */
export function bodyHalf(frame: Frame): Chain {
  const { basis, options } = frame;
  const side = pt(basis.halfHem, basis.length - hemLift(frame, basis.halfHem));
  const shoulder = options.raglan ? chain(pt(basis.seamX, 0)) : chain(pt(basis.seamX, 0), lineTo(basis.top));
  return joinChains(shoulder, armholeChain(frame), chain(basis.underarm, lineTo(side)), hemSegment(frame, basis.halfHem, 0));
}

/** The whole body panel, closed by the neck seam. It runs round the outline once. */
export function bodyOutline(frame: Frame): Chain {
  const half = bodyHalf(frame);
  return joinChains(half, reverseChain(mirrorChain(half)), reverseChain(bothSides(neckSeam(frame))));
}

export interface SleevePlan {
  /** The seam at the shoulder: from the top of the armhole to the underarm. */
  readonly seam: Chain;
  readonly topEnd: Point;
  readonly lowerEnd: Point;
}

/** Where the open end of the sleeve is. */
export function sleeveEnds(basis: Basis): { topEnd: Point; lowerEnd: Point } {
  const topEnd = add(basis.top, basis.along, basis.sleeveLength);
  return { topEnd, lowerEnd: add(topEnd, basis.across, basis.sleeveOpening) };
}

/**
 * The point where the underarm edge of the sleeve meets a line that runs across the sleeve
 * at a given distance from the top of the armhole, along the top edge.
 */
function underEdgeAt(basis: Basis, distance: number, lowerEnd: Point): Point {
  const edge = sub(lowerEnd, basis.underarm);
  const reach = (p: Point): number => (p.x - basis.top.x) * basis.along.x + (p.y - basis.top.y) * basis.along.y;
  const share = (distance - reach(basis.underarm)) / (reach(lowerEnd) - reach(basis.underarm));
  return add(basis.underarm, edge, share);
}

/**
 * The sleeve on the right. With a cuff, the panel stops where the cuff begins and
 * `cuffLength` says how deep the cuff is. The second chain is the cuff.
 */
export function sleeveChains(frame: Frame, cuffLength: number): { sleeve: Chain; cuff: Chain | null } {
  const { basis } = frame;
  const { topEnd, lowerEnd } = sleeveEnds(basis);
  const armhole = armholeChain(frame);
  if (cuffLength <= 0) {
    const sleeve = joinChains(chain(basis.top, lineTo(topEnd), lineTo(lowerEnd), lineTo(basis.underarm)), reverseChain(armhole));
    return { sleeve, cuff: null };
  }
  const cut = basis.sleeveLength - cuffLength;
  const cutTop = add(basis.top, basis.along, cut);
  const cutLow = underEdgeAt(basis, cut, lowerEnd);
  const sleeve = joinChains(chain(basis.top, lineTo(cutTop), lineTo(cutLow), lineTo(basis.underarm)), reverseChain(armhole));
  return { sleeve, cuff: chain(cutTop, lineTo(topEnd), lineTo(lowerEnd), lineTo(cutLow)) };
}
