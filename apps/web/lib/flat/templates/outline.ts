import { chain, closedCommands, joinChains, lineTo, mirrorChain, pt, reverseChain, type Chain } from "../chain";
import type { PathCommand, Point } from "../model";
import { tidyCommands } from "../paths";
import { standTop } from "./collar";
import { bothSides, hemLift, hemSegment, neckOpening, sleeveEnds, type Frame } from "./pieces";
import { poloBackTop, poloFrontEdges, poloSeamRight } from "./polo-collar";

/** The whole garment as one silhouette, and the boundary of its neck opening, for one view. */
export interface Outline {
  readonly silhouette: readonly PathCommand[];
  readonly neck: readonly PathCommand[];
}

interface NeckEdge {
  /** The right half of the edge at the neck: from where it meets the shoulder line in to the centre line. */
  readonly edge: Chain;
  /** The point on the shoulder line where the silhouette leaves the neck. */
  readonly join: Point;
  /** The right half of the boundary of the opening. It is the edge, except behind a polo collar. */
  readonly hole: Chain;
}

const onShoulder = (frame: Frame, x: number): Point => pt(x, frame.basis.shoulderSlope * (x - frame.basis.seamX));

/** The edge at the neck, worked out for the collar and the view. */
function neckEdge(frame: Frame): NeckEdge {
  const { collar } = frame.options;
  if (collar === "polo-collar" && frame.view === "front") {
    const { corner, behind } = poloFrontEdges(frame);
    return { edge: chain(corner, behind), join: corner, hole: poloSeamRight(frame) };
  }
  if (collar === "polo-collar") {
    const top = poloBackTop(frame);
    return { edge: top, join: onShoulder(frame, top.start.x), hole: top };
  }
  if (collar === "band-collar") {
    const top = standTop(frame, frame.collarHeight);
    return { edge: top, join: pt(frame.basis.neckHalf, 0), hole: top };
  }
  const opening = neckOpening(frame);
  return { edge: opening, join: pt(frame.basis.seamX, 0), hole: opening };
}

/**
 * Draws the silhouette from the neck edge on the right, out along the shoulder and the
 * sleeve, down the side and along the hem, and back up the left, closing across the neck.
 * The neck edge is where the silhouette is cut, so the collar is inside it.
 */
export function outlineOf(frame: Frame): Outline {
  const { basis } = frame;
  const { edge, join, hole } = neckEdge(frame);
  const { topEnd, lowerEnd } = sleeveEnds(basis);
  const side = pt(basis.halfHem, basis.length - hemLift(frame, basis.halfHem));
  const shoulder = frame.options.raglan ? [] : [lineTo(basis.top)];
  // A polo collar meets the shoulder line where its edge starts, so there is no step to it: a
  // step of no length would leave the same point twice in the outline.
  const toJoin = join.x === edge.start.x && join.y === edge.start.y ? [] : [lineTo(join)];
  const right = joinChains(
    chain(edge.start, ...toJoin, ...shoulder, lineTo(topEnd), lineTo(lowerEnd), lineTo(basis.underarm), lineTo(side)),
    hemSegment(frame, basis.halfHem, 0),
  );
  const silhouette = joinChains(right, reverseChain(mirrorChain(right)), reverseChain(bothSides(edge)));
  return { silhouette: tidyCommands(closedCommands(silhouette)), neck: tidyCommands(closedCommands(bothSides(hole))) };
}
