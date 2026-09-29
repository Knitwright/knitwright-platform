import {
  chain,
  curveTo,
  joinChains,
  lineTo,
  mirrorChain,
  pt,
  quarterDown,
  reverseChain,
  shiftChain,
  type Chain,
  type Piece,
} from "../chain";
import type { Point } from "../model";
import { bothSides, neckOpening, neckSeam, type Frame } from "./pieces";

const KAPPA = 0.5522847498;
/** Shares of the collar height, and of the chest width, for the parts of a collar. */
const POLO_TIP_DROP = 0.6;
const POLO_FLARE = 0.5;
const POLO_BACK_INNER = 0.42;
const POLO_BACK_OUTER = 0.8;
const POLO_GAP = 0.008;
/** A stand collar leans in a little as it rises, so its top edge is narrower than its foot. */
const BAND_LEAN = 0.1;
const FOLD_BOW = 0.09;

/** The ring of rib round the neck opening: from the opening out to the seam. */
export function neckbandChain(frame: Frame): Chain {
  return joinChains(bothSides(neckOpening(frame)), reverseChain(bothSides(neckSeam(frame))));
}

/**
 * A stand collar: a band that rises above the neckline, curved to follow it. It is used
 * for a band collar on both views, and for the back of a polo collar.
 */
export function standCollarChain(frame: Frame, height: number): Chain {
  const a = frame.basis.neckHalf;
  const outer = a - height * BAND_LEAN;
  const bottom = bothSides(chain(pt(a, 0), quarterDown(a, frame.drop)));
  const top = bothSides(shiftChain(chain(pt(outer, 0), quarterDown(outer, frame.drop)), 0, -height));
  return joinChains(bottom, reverseChain(top));
}

/** The outer edge of a collar leaf: nearly straight, bowed a little outwards so it clears the neck seam. */
function foldEdge(tip: Point, corner: Point): Piece {
  const dx = corner.x - tip.x;
  const dy = corner.y - tip.y;
  const length = Math.hypot(dx, dy);
  const bow = FOLD_BOW * length;
  const out = pt((-dy / length) * bow, (dx / length) * bow);
  return curveTo(pt(tip.x + dx * 0.3 + out.x, tip.y + dy * 0.3 + out.y), pt(tip.x + dx * 0.7 + out.x, tip.y + dy * 0.7 + out.y), corner);
}

/**
 * The front of a polo collar: two leaves that lie over the placket, joined by the stand
 * at the back of the neck. The outline is one piece with the neck opening left open.
 */
export function poloFrontChain(frame: Frame): Chain {
  const a = frame.basis.neckHalf;
  const h = frame.collarHeight;
  const b = frame.drop;
  const gap = POLO_GAP * frame.basis.chest;
  const innerTop = -POLO_BACK_INNER * h;
  const seam = chain(
    pt(gap, b),
    curveTo(pt(a * KAPPA, b), pt(a, b * KAPPA), pt(a, 0)),
    curveTo(pt(a, innerTop * KAPPA), pt(a * KAPPA, innerTop), pt(0, innerTop)),
  );
  const inner = joinChains(seam, reverseChain(mirrorChain(seam)));
  const tip = pt(gap, b + POLO_TIP_DROP * h);
  const corner = pt(a + POLO_FLARE * h, -0.1 * h);
  const outerTop = -POLO_BACK_OUTER * h;
  const fold = foldEdge(tip, corner);
  const outerRight = chain(tip, fold, curveTo(pt(corner.x, outerTop * 0.55), pt(a * 0.6, outerTop), pt(0, outerTop)));
  return joinChains(inner, reverseChain(bothSides(outerRight)));
}

/** The whole collar for this view, or null when the design has none. */
export function collarChain(frame: Frame): Chain | null {
  const { collar } = frame.options;
  if (collar === "none") return null;
  if (collar === "polo-collar" && frame.view === "front") return poloFrontChain(frame);
  const height = collar === "polo-collar" ? frame.collarHeight * 0.8 : frame.collarHeight * 0.9;
  return standCollarChain(frame, height);
}

/** Where the placket starts: at the neck seam, or below the neckband when there is one. */
export const placketTop = (frame: Frame): number => frame.drop + frame.basis.band * (frame.options.collar === "none" ? 1 : 0);

/** The strip down the centre front that fastens the neck opening. */
export function placketChain(frame: Frame): Chain {
  const half = frame.placketWidth / 2;
  const top = placketTop(frame);
  const bottom = top + frame.placketLength;
  return chain(pt(-half, top), lineTo(pt(half, top)), lineTo(pt(half, bottom)), lineTo(pt(-half, bottom)));
}
