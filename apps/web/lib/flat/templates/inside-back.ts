import { chain, curveTo, joinChains, pt, quarterDown, reverseChain, type Chain } from "../chain";
import { standTop } from "./collar";
import { poloStandInnerTop } from "./polo-collar";
import { bothSides, isV, neckEndY, neckOpening, type Frame } from "./pieces";

const KAPPA = 0.5522847498;

/** A curve from a point on the right, bowing down and in, to the centre line at a given height. */
const arc = (from: { x: number; y: number }, middleY: number): Chain =>
  chain(from, curveTo(pt(from.x, from.y + (middleY - from.y) * KAPPA), pt(from.x * KAPPA, middleY), pt(0, middleY)));

/** A curve that leaves along the straight line to the middle, so it cannot cross a V that ends lower. */
const shallowArc = (from: { x: number; y: number }, middleY: number): Chain =>
  chain(from, curveTo(pt(from.x * 0.67, from.y + (middleY - from.y) * 0.2), pt(from.x * 0.33, middleY), pt(0, middleY)));

/**
 * What can be seen through the neck opening from the front: the inside of the back of the
 * garment. It lies between the edge of the front opening and the edge of the back neckline,
 * or of the back of the collar. Only the front view has it. Null on the back.
 */
export function insideBackChain(frame: Frame): Chain | null {
  if (frame.view !== "front") return null;
  const a = frame.basis.neckHalf;
  const { collar } = frame.options;
  if (collar === "band-collar") {
    const front = standTop(frame, frame.collarHeight);
    const back = arc(front.start, frame.backDrop - frame.collarHeight);
    return joinChains(bothSides(front), reverseChain(bothSides(back)));
  }
  const y0 = neckEndY(frame);
  const front = collar === "polo-collar" ? chain(pt(a, 0), quarterDown(a, frame.drop)) : neckOpening(frame);
  const start = pt(a, y0);
  const round = collar === "polo-collar" ? arc(pt(a, 0), poloStandInnerTop(frame)) : arc(start, frame.backDrop);
  // Seen through a V, the back neckline is drawn as a shallow curve that stays above the V edges.
  const back = isV(frame) ? shallowArc(start, frame.backDrop) : round;
  return joinChains(bothSides(front), reverseChain(bothSides(back)));
}
