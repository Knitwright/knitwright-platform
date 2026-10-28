import { chain, curveTo, joinChains, lineTo, mirrorChain, openCommands, pt, quarterDown, reverseChain, type Chain } from "../../chain";
import { flatten } from "../../geometry";
import { need, type Dims } from "../../dimensions";
import type { Point, View } from "../../model";
import type { CloseFitOptions } from "./options";

/** Shares of the chest width for parts of the drawing that have no point of measure. */
const BINDING_WIDTH = 0.025;
const UNDERBAND_HEIGHT = 0.14;
const SHOULDER_SLOPE = 0.25;
const KAPPA = 0.5522847498;
/** How far down the armhole the back is narrowest, as a share of the armhole depth. */
const NARROW_AT: Readonly<Record<"straight" | "racerback", number>> = { straight: 0.72, racerback: 0.5 };

/** Where everything on a singlet, vest or sports bra is, on the right half. y runs down from the neck. */
export interface SleevelessShape {
  readonly view: View;
  readonly options: CloseFitOptions;
  readonly chest: number;
  readonly neckHalf: number;
  /** The drop of the neck opening in this view. */
  readonly drop: number;
  /** The outer end of the strap at the shoulder. */
  readonly strapTop: Point;
  readonly underarm: Point;
  readonly length: number;
  /** Half the width of the bottom edge: the hem, or the underband of a sports bra. */
  readonly hemHalf: number;
  /** On the back: the narrowest point of the back, between the armholes. Null on the front. */
  readonly narrow: Point | null;
  readonly band: number;
  readonly binding: number;
}

interface SleevelessResult {
  readonly shape: SleevelessShape | null;
  readonly problems: readonly string[];
}

const STRAPS_WIDE = "The neck and the straps together are wider than the chest.";
const ARMHOLE_SHORT = "The armhole is too shallow for the neck.";
const BODY_SHORT = "The body is too short for the armhole.";
const BACK_FIT = "The back width does not fit between the armholes.";
const BACK_NECK_DEEP = "The back neck is too deep for the straps of the back.";
const HEM_NARROW = "The bottom edge is too narrow for the chest.";

/** Draws nothing. Says whether the measurements can be drawn together, and places everything if so. */
export function sleevelessShapeOf(dims: Dims, options: CloseFitOptions, view: View): SleevelessResult {
  const d = (id: string): number => need(dims, id);
  const chest = d("chest-width");
  const neckHalf = d("neck-width") / 2;
  const strap = d("strap-width");
  const depth = d("armhole-depth");
  const length = d("body-length");
  const hemHalf = (options.underband ? d("underbust") : d("hem-width")) / 2;
  const backHalf = d("back-width-narrowest") / 2;
  const narrowY = depth * NARROW_AT[options.racerback ? "racerback" : "straight"];
  const binding = BINDING_WIDTH * chest;
  const problems: string[] = [];
  if (neckHalf + strap >= chest / 2 * 0.92) problems.push(STRAPS_WIDE);
  if (depth <= Math.max(d("front-neck-drop"), 0.15 * chest) * 0.9) problems.push(ARMHOLE_SHORT);
  if (length < depth + (options.underband ? UNDERBAND_HEIGHT * chest * 1.2 : 0.2 * chest)) problems.push(BODY_SHORT);
  const backTooNarrow = options.racerback ? backHalf < binding * 2 : backHalf < neckHalf + strap;
  if (backHalf >= (chest / 2) * 0.98 || backTooNarrow) problems.push(BACK_FIT);
  if (d("back-neck-drop") >= narrowY * 0.75) problems.push(BACK_NECK_DEEP);
  if (hemHalf < chest * 0.3) problems.push(HEM_NARROW);
  if (problems.length > 0) return { shape: null, problems };
  const strapTop = pt(neckHalf + strap, strap * SHOULDER_SLOPE);
  return {
    shape: {
      view,
      options,
      chest,
      neckHalf,
      drop: d(view === "front" ? "front-neck-drop" : "back-neck-drop"),
      strapTop,
      underarm: pt(chest / 2, depth),
      length,
      hemHalf,
      narrow: view === "back" ? pt(backHalf, narrowY) : null,
      band: options.underband ? UNDERBAND_HEIGHT * chest : 0,
      binding,
    },
    problems,
  };
}

/** The armhole edge on the right, from the top of the strap down to the underarm. */
export function armholeEdge(shape: SleevelessShape): Chain {
  const { strapTop, underarm, narrow } = shape;
  const reach = (underarm.x - strapTop.x) * 0.55;
  if (!narrow) {
    return chain(strapTop, curveTo(pt(strapTop.x, strapTop.y + (underarm.y - strapTop.y) * 0.55), pt(underarm.x - reach, underarm.y), underarm));
  }
  if (!shape.options.racerback) {
    // A straight back is widest across the shoulder blades: the edge bows out towards the back width.
    return chain(strapTop, curveTo(pt(narrow.x, narrow.y * 0.75), pt(underarm.x - reach * 0.6, underarm.y), underarm));
  }
  // On the back the edge runs in to the narrowest point of the back, then out to the underarm.
  const upper = narrow.y - strapTop.y;
  const lower = underarm.y - narrow.y;
  return chain(
    strapTop,
    curveTo(pt(strapTop.x, strapTop.y + upper * 0.45), pt(narrow.x, narrow.y - upper * 0.45), narrow),
    curveTo(pt(narrow.x, narrow.y + lower * 0.6), pt(underarm.x - (underarm.x - narrow.x) * 0.4, underarm.y), underarm),
  );
}

/** The neck edge on the right, from the strap in to the centre. */
export function neckEdge(shape: SleevelessShape): Chain {
  return chain(pt(shape.neckHalf, 0), quarterDown(shape.neckHalf, shape.drop));
}

/** The right half of the body, from the neck at the strap round to the centre of the hem. */
function sleevelessHalf(shape: SleevelessShape): Chain {
  return joinChains(chain(pt(shape.neckHalf, 0), lineTo(shape.strapTop)), armholeEdge(shape), chain(shape.underarm, lineTo(pt(shape.hemHalf, shape.length)), lineTo(pt(0, shape.length))));
}

/** The whole body, closed by the neck edge. It is the silhouette too. */
export function sleevelessOutline(shape: SleevelessShape): Chain {
  const half = sleevelessHalf(shape);
  const neck = neckEdge(shape);
  return joinChains(half, reverseChain(mirrorChain(half)), mirrorChain(neck), reverseChain(neck));
}

/** The opening of the neck, as a closed loop across the top of the straps. */
export const neckLoop = (shape: SleevelessShape): Chain => joinChains(neckEdge(shape), reverseChain(mirrorChain(neckEdge(shape))));

/** The x of the side seam at height y, between the underarm and the hem. */
export function sideAt(shape: SleevelessShape, y: number): number {
  const share = (y - shape.underarm.y) / (shape.length - shape.underarm.y);
  return shape.underarm.x + (shape.hemHalf - shape.underarm.x) * share;
}

/** The underband of a sports bra: a band across the bottom of the body. */
export function underbandOutline(shape: SleevelessShape): Chain {
  const top = shape.length - shape.band;
  const x = sideAt(shape, top);
  return chain(pt(-x, top), lineTo(pt(x, top)), lineTo(pt(shape.hemHalf, shape.length)), lineTo(pt(-shape.hemHalf, shape.length)));
}

/**
 * An armhole edge moved into the body by a distance, along its normal at every point. The edge
 * runs from the strap down to the underarm, so the body lies to its left as it is drawn.
 */
function inward(item: Chain, distance: number, end?: Point): Chain {
  const [run] = flatten(openCommands(item));
  const points = run?.points ?? [item.start];
  const moved = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)] as Point;
    const after = points[Math.min(points.length - 1, index + 1)] as Point;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const size = Math.hypot(dx, dy) || 1;
    return pt(point.x - (dy / size) * distance, point.y + (dx / size) * distance);
  });
  // The last point is put on the side seam, so the strip ends inside the body.
  const ends = end ? [...moved.slice(0, -1), end] : moved;
  const [first, ...rest] = ends;
  return chain(first as Point, ...rest.map(lineTo));
}

/** Where the side seam is, a distance below the underarm. */
const belowUnderarm = (shape: SleevelessShape, distance: number): Point =>
  pt(sideAt(shape, shape.underarm.y + distance), shape.underarm.y + distance);

/** The binding round the neck: a ring inside the neck edge, across both straps. */
export function neckBinding(shape: SleevelessShape): Chain {
  const b = shape.binding;
  // The outer edge starts on the top of the strap, which slopes down towards the shoulder.
  const start = pt(shape.neckHalf + b, b * SHOULDER_SLOPE);
  const bottom = shape.drop + b;
  const outer = chain(start, curveTo(pt(start.x, start.y + (bottom - start.y) * KAPPA), pt(start.x * KAPPA, bottom), pt(0, bottom)));
  return joinChains(neckEdge(shape), reverseChain(mirrorChain(neckEdge(shape))), mirrorChain(outer), reverseChain(outer));
}

/** The binding along the armhole on the right. */
export const armholeBinding = (shape: SleevelessShape): Chain =>
  joinChains(armholeEdge(shape), reverseChain(armholeBindingSeam(shape)));

/** The line where the armhole binding is sewn to the body, on the right. */
export const armholeBindingSeam = (shape: SleevelessShape): Chain =>
  inward(armholeEdge(shape), shape.binding, belowUnderarm(shape, shape.binding));
