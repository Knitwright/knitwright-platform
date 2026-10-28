import { chain, curveTo, joinChains, mirrorChain, pt, reverseChain, type Chain, type Piece } from "../chain";
import type { Point } from "../model";
import { bothSides, type Frame } from "./pieces";

const KAPPA = 0.5522847498;
/**
 * Shares of the collar height, and of the chest width, for the parts of a polo collar. The
 * collar lies flat: from the front, the leaves spread over the shoulders and the back of the
 * collar is a band behind the neck whose top edge, the fold, runs almost level a little above
 * the shoulder line. It never rises round the head.
 */
const POLO_TIP_DROP = 0.5;
const POLO_REACH = 0.8;
/** How far the fold at the top of the collar sits above the back neck seam, at the centre back. */
const POLO_FOLD_RISE = 0.6;
/** How far the fall of the collar hangs below the back neck seam, seen from the back. */
const POLO_FALL = 0.2;
const POLO_GAP = 0.008;
/** How far each collar point sits out from the centre front, so the two points spread apart over the placket. */
const POLO_TIP_SPREAD = 0.065;
const FOLD_BOW = 0.14;
const ROLL_SHARE = 0.4;

/** The foot of the collar stand at the centre back: the back neck seam, seen from the front through the opening. */
export const poloStandFoot = (frame: Frame): number => frame.backDrop;

/** The fold at the top of the collar at the centre back (a negative number is above the shoulder line). */
const foldTop = (frame: Frame): number => frame.backDrop - POLO_FOLD_RISE * frame.collarHeight;

/** How far the two collar leaves stand apart at the centre front. */
const gapOf = (frame: Frame): number => POLO_GAP * frame.basis.chest;

/** Where the point of the right leaf is: below the neckline and a little out from the centre front. */
const tipOf = (frame: Frame): Point => pt(POLO_TIP_SPREAD * frame.basis.chest, frame.drop + poloTipDepth(frame));

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

/** The inner edge of the collar on the right: the neck seam down the front, and the foot of the stand at the back neck seam. */
export function poloSeamRight(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const b = frame.drop;
  const gap = gapOf(frame);
  const foot = poloStandFoot(frame);
  return chain(
    pt(gap, b),
    curveTo(pt(gap + (a - gap) * KAPPA, b), pt(a, b * KAPPA), pt(a, 0)),
    curveTo(pt(a, foot * KAPPA), pt(a * KAPPA, foot), pt(0, foot)),
  );
}

/** The points and the curve behind the neck that shape the outside of a leaf on the right. */
export function poloFrontEdges(frame: Frame): { tip: Point; corner: Point; behind: Piece } {
  const a = frame.basis.neckHalf;
  const tip = tipOf(frame);
  const corner = cornerOf(frame);
  const top = foldTop(frame);
  // The fold rises from the shoulder close to the neck, then runs nearly level across the back.
  return { tip, corner, behind: curveTo(pt(a * 1.05, corner.y + (top - corner.y) * 0.8), pt(a * 0.6, top), pt(0, top)) };
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
  const tip = tipOf(frame);
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
 * The back of a polo collar, seen from behind: the fall of the collar, folded down over the
 * back neck seam. Its top edge is the fold and its lower edge hangs a little below the seam.
 * Both run out to the corner on each shoulder where the collar turns to the front, as the
 * front view's leaves do.
 */
export function poloBackChain(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const corner = cornerOf(frame);
  const fall = frame.backDrop + POLO_FALL * frame.collarHeight;
  const bottom = bothSides(chain(corner, curveTo(pt(a * 1.05, corner.y + (fall - corner.y) * 0.7), pt(a * 0.6, fall), pt(0, fall))));
  return joinChains(bottom, reverseChain(bothSides(poloBackTop(frame))));
}

/** The top edge of the back of the collar on the right, the fold: from the corner on the shoulder up to the middle. */
export function poloBackTop(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const corner = cornerOf(frame);
  const top = foldTop(frame);
  return chain(corner, curveTo(pt(a * 1.05, corner.y + (top - corner.y) * 0.8), pt(a * 0.6, top), pt(0, top)));
}
