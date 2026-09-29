import { chain, curveTo, endOf, joinChains, lineTo, mirrorChain, pt, tailOfCubic, type Chain } from "../chain";
import { SIDE_PANEL_WIDTH } from "./basis";
import { armholeChain, hemLift, hemSegment, type Frame } from "./pieces";

/** How far up the armhole the inner end of a side panel reaches, as a share of the armhole from the top. */
const TOP_REACH = 0.8;

export interface SidePanel {
  /** The whole strip on the right, closed: side seam, hem, inner edge and a piece of the armhole. */
  readonly strip: Chain;
  /** The inner edge, from the hem up to the armhole, which is sewn to the body. */
  readonly inner: Chain;
}

/**
 * A strip that runs down each side of the body. Its outer edge is the side seam from the
 * underarm to the hem. It follows the armhole at the top and the hem at the bottom, and it
 * is thinner at the underarm than at the hem.
 */
export function sidePanelOnRight(frame: Frame): SidePanel {
  const { basis } = frame;
  const width = SIDE_PANEL_WIDTH * basis.chest;
  const armhole = armholeChain(frame);
  const armholePiece = armhole.pieces[0] ?? { to: basis.underarm };
  const tail = tailOfCubic(armhole.start, armholePiece, TOP_REACH);
  const side = pt(basis.halfHem, basis.length - hemLift(frame, basis.halfHem));
  const hemRun = hemSegment(frame, basis.halfHem, basis.halfHem - width);
  const hemIn = endOf(hemRun);
  const rise = hemIn.y - tail.start.y;
  const inner = chain(hemIn, curveTo(pt(hemIn.x, hemIn.y - rise * 0.5), pt(tail.start.x, tail.start.y + rise * 0.15), tail.start));
  return { strip: joinChains(chain(basis.underarm, lineTo(side)), hemRun, inner, tail), inner };
}

/** Both strips, right then left. */
export const sidePanelChains = (frame: Frame): Chain[] => {
  const { strip } = sidePanelOnRight(frame);
  return [strip, mirrorChain(strip)];
};
