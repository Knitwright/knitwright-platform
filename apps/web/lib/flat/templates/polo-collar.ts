import { chain, curveTo, joinChains, mirrorChain, pt, reverseChain, type Chain, type Piece } from "../chain";
import type { Point } from "../model";
import { bothSides, type Frame } from "./pieces";

const KAPPA = 0.5522847498;
/** Shares of the collar height, and of the chest width, for the parts of a polo collar. */
export const POLO_TIP_DROP = 0.5;
const POLO_REACH = 0.9;
const POLO_STAND_INNER = 0.42;
const POLO_STAND_OUTER = 0.8;
const POLO_GAP = 0.008;
const FOLD_BOW = 0.06;
const ROLL_SHARE = 0.4;
const BACK_END_RISE = 0.1;
const BACK_END_FLARE = 0.15;
const BACK_TOP = 0.7;

/** The height of the inside edge of the collar stand at the back, above the shoulder line (a negative number). */
export const poloStandInnerTop = (frame: Frame): number => -POLO_STAND_INNER * frame.collarHeight;

/** How far the two collar leaves stand apart at the centre front. */
const gapOf = (frame: Frame): number => POLO_GAP * frame.basis.chest;

/** How far below the neckline the tips of the leaves hang. */
export const poloTipDepth = (frame: Frame): number => POLO_TIP_DROP * frame.collarHeight;

/** The outer edge of a collar leaf: nearly straight, bowed a little outwards so it clears the neck seam. */
function foldEdge(tip: Point, corner: Point): Piece {
  const dx = corner.x - tip.x;
  const dy = corner.y - tip.y;
  const length = Math.hypot(dx, dy);
  const bow = FOLD_BOW * length;
  const out = pt((-dy / length) * bow, (dx / length) * bow);
  return curveTo(pt(tip.x + dx * 0.3 + out.x, tip.y + dy * 0.3 + out.y), pt(tip.x + dx * 0.7 + out.x, tip.y + dy * 0.7 + out.y), corner);
}

/** The corner where a leaf meets the stand: out over the shoulder, on the shoulder line, because the collar lies flat on it. */
const cornerOf = (frame: Frame): Point => {
  const reach = POLO_REACH * frame.collarHeight;
  return pt(frame.basis.neckHalf + reach, frame.basis.shoulderSlope * (frame.basis.neckHalf + reach - frame.basis.seamX));
};

/**
 * The front of a folded polo collar as one piece with the neck opening left open: two
 * leaves that come to points and hang below the neckline over the top of the placket, joined
 * at the back by the collar stand.
 */
export function poloFrontChain(frame: Frame): Chain {
  const seam = poloSeamRight(frame);
  const inner = joinChains(seam, reverseChain(mirrorChain(seam)));
  const { tip, corner, behind } = poloFrontEdges(frame);
  const outerRight = chain(tip, foldEdge(tip, corner), behind);
  return joinChains(inner, reverseChain(bothSides(outerRight)));
}

/** The inner edge of the collar on the right: the neck seam down the front, and the inside of the stand at the back. */
export function poloSeamRight(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const b = frame.drop;
  const gap = gapOf(frame);
  const innerTop = poloStandInnerTop(frame);
  return chain(
    pt(gap, b),
    curveTo(pt(gap + (a - gap) * KAPPA, b), pt(a, b * KAPPA), pt(a, 0)),
    curveTo(pt(a, innerTop * KAPPA), pt(a * KAPPA, innerTop), pt(0, innerTop)),
  );
}

/** The points and the curve behind the neck that shape the outside of a leaf on the right. */
export function poloFrontEdges(frame: Frame): { tip: Point; corner: Point; behind: Piece } {
  const a = frame.basis.neckHalf;
  const tip = pt(gapOf(frame), frame.drop + poloTipDepth(frame));
  const corner = cornerOf(frame);
  const outerTop = -POLO_STAND_OUTER * frame.collarHeight;
  return { tip, corner, behind: curveTo(pt(corner.x * 0.85, corner.y - (corner.y - outerTop) * 0.55), pt(a * 0.7, outerTop), pt(0, outerTop)) };
}

const lerp = (from: Point, to: Point, share: number): Point => pt(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share);

/**
 * The fold (roll) line of the right leaf: where the collar turns over. It runs between the
 * neck seam and the outer edge of the leaf, blended from the two so that it can never leave
 * the leaf.
 */
export function poloFoldLine(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const b = frame.drop;
  const gap = gapOf(frame);
  const tip = pt(gap, b + poloTipDepth(frame));
  const corner = cornerOf(frame);
  const edge = foldEdge(tip, corner);
  const seamStart = pt(gap, b);
  const seamC1 = pt(gap + (a - gap) * KAPPA, b);
  const seamC2 = pt(a, b * KAPPA);
  const seamEnd = pt(a, 0);
  const share = ROLL_SHARE;
  const start = lerp(seamStart, tip, share + 0.2);
  const inside = pt(start.x + 2 * gap, start.y);
  return chain(
    inside,
    curveTo(lerp(seamC1, edge.c1 as Point, share), lerp(seamC2, edge.c2 as Point, share), lerp(seamEnd, corner, share)),
  );
}

/**
 * The back of a polo collar: a band that follows the back neckline, arching up behind the
 * neck, with its ends flaring out over the shoulder.
 */
export function poloBackChain(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const bottom = bothSides(chain(pt(a, 0), curveTo(pt(a, frame.drop * KAPPA), pt(a * KAPPA, frame.drop), pt(0, frame.drop))));
  return joinChains(bottom, reverseChain(bothSides(poloBackTop(frame))));
}

/** The top edge of the back of the collar on the right: from its end over the shoulder up to the middle. */
export function poloBackTop(frame: Frame): Chain {
  const h = frame.collarHeight;
  const end = pt(frame.basis.neckHalf + BACK_END_FLARE * h, -BACK_END_RISE * h);
  const middle = frame.drop - BACK_TOP * h;
  return chain(end, curveTo(pt(end.x * 0.85, end.y + (middle - end.y) * 0.6), pt(end.x * 0.4, middle), pt(0, middle)));
}
