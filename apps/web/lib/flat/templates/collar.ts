import {
  chain,
  curveTo,
  joinChains,
  lineTo,
  pt,
  quarterDown,
  reverseChain,
  type Chain,
} from "../chain";
import { bothSides, neckOpening, neckSeam, type Frame } from "./pieces";
import { poloBackChain, poloFrontChain } from "./polo-collar";

const KAPPA = 0.5522847498;
/**
 * A stand collar wraps round the neck, so from the front its band looks shallower at the
 * sides than at the middle. The ends are this share of the full height, and lean in a little.
 */
const STAND_END_HEIGHT = 0.4;
const STAND_END_LEAN = 0.04;

/** The ring of rib round the neck opening: from the opening out to the seam. */
export function neckbandChain(frame: Frame): Chain {
  return joinChains(bothSides(neckOpening(frame)), reverseChain(bothSides(neckSeam(frame))));
}

/** The top edge of a stand collar on the right: from its end at the side, down to the middle. */
export function standTop(frame: Frame, height: number): Chain {
  const a = frame.basis.neckHalf;
  const end = pt(a * (1 - STAND_END_LEAN), -STAND_END_HEIGHT * height);
  const middle = frame.drop - height;
  return chain(end, curveTo(pt(end.x, end.y + (middle - end.y) * KAPPA), pt(end.x * KAPPA, middle), pt(0, middle)));
}

/**
 * A stand collar: a band that follows the neckline, with its foot on the neck seam and a
 * gently curved top edge. It is used for a band collar on both views.
 */
export function standCollarChain(frame: Frame, height: number): Chain {
  const a = frame.basis.neckHalf;
  const bottom = bothSides(chain(pt(a, 0), quarterDown(a, frame.drop)));
  return joinChains(bottom, reverseChain(bothSides(standTop(frame, height))));
}

/** The collar for this view, or null when the design has none. */
export function collarChain(frame: Frame): Chain | null {
  const { collar } = frame.options;
  if (collar === "none") return null;
  if (collar === "polo-collar") return frame.view === "front" ? poloFrontChain(frame) : poloBackChain(frame);
  return standCollarChain(frame, frame.collarHeight);
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
