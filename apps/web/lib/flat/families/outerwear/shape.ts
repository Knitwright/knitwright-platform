import { chain, curveTo, joinChains, lineTo, mirrorChain, pt, reverseChain, type Chain } from "../../chain";
import { need, type Dims } from "../../dimensions";
import type { View } from "../../model";
import { basisOf } from "../../templates/basis";
import { bothSides, frameOf, neckSeam, sleeveChains, sleeveEnds, type Frame } from "../../templates/pieces";
import { asTopsOptions, type OuterwearOptions } from "./options";

/** Shares of the chest width for parts of the drawing that have no point of measure. */
const HOOD_FRONT_SHARE = 0.62;
const FACE_SHARE = 0.62;
const PLAIN_HEM_GAP = 0.04;

/** Everything a hoodie or track jacket drawing needs: the frame of a top, and what outerwear adds. */
export interface OuterwearShape {
  readonly frame: Frame;
  readonly options: OuterwearOptions;
  readonly chest: number;
  readonly hoodHeight: number;
  /** Half the width of the hood seen from the front or the back. */
  readonly hoodHalf: number;
  readonly cuffHeight: number;
  readonly hemBand: number;
  /** Where the hem band starts, or where a plain hem is stitched. The kangaroo pocket sits on it. */
  readonly hemTop: number;
  readonly zipTop: number;
  readonly pocketOpening: number;
  readonly pocketWidth: number;
  readonly pocketHeight: number;
}

export interface OuterwearShapeResult {
  readonly shape: OuterwearShape | null;
  readonly problems: readonly string[];
}

const HOOD_NARROW = "The hood is too narrow for the neck opening.";
const HOOD_LOW = "The hood is too low to reach over the head.";
const ZIP_FIT = "The zip does not reach from the hem up to the neck.";
const POCKET_FIT = "The pocket does not fit on the front.";
const CUFF_DEEP = "The cuff is too deep for the sleeve.";
const BAND_DEEP = "The hem band is too deep for the body.";

function outerwearProblems(frame: Frame, dims: Dims, options: OuterwearOptions): string[] {
  const d = (id: string): number => need(dims, id);
  const { basis } = frame;
  const problems: string[] = [];
  if (options.hood !== "none") {
    if (d("hood-width") * HOOD_FRONT_SHARE < basis.seamX * 1.1) problems.push(HOOD_NARROW);
    if (d("hood-height") < 0.35 * basis.chest || d("hood-height") > 1.3 * basis.chest) problems.push(HOOD_LOW);
  }
  if (options.fullZip) {
    // The zip is on the front, so it is checked against the front neck in both views.
    const drop = d("front-neck-drop");
    const top = basis.length - d("zip-length");
    const highest = options.collar === "stand" ? drop - frame.collarHeight * 1.1 : drop - 0.02 * basis.chest;
    if (top < highest || top > drop + basis.band + 0.08 * basis.chest) problems.push(ZIP_FIT);
  }
  if (options.pockets === "kangaroo" && (d("pocket-width") > basis.halfHem * 1.9 || d("pocket-height") > (basis.length - basis.underarm.y) * 0.9)) {
    problems.push(POCKET_FIT);
  }
  if (options.pockets !== "none" && d("pocket-opening") > (basis.length - basis.underarm.y) * 0.9) problems.push(POCKET_FIT);
  if (options.ribCuffs && d("cuff-height") > basis.sleeveLength * 0.4) problems.push(CUFF_DEEP);
  if (options.ribHem && d("hem-band-height") > (basis.length - basis.underarm.y) * 0.4) problems.push(BAND_DEEP);
  return problems;
}

/** Draws nothing. Says whether the measurements can be drawn together, and places everything if so. */
export function outerwearShapeOf(dims: Dims, options: OuterwearOptions, view: View): OuterwearShapeResult {
  const tops = asTopsOptions(options);
  const { basis, problems: topProblems } = basisOf(dims, tops);
  if (!basis) return { shape: null, problems: topProblems };
  const frame = frameOf(basis, tops, view, dims);
  const problems = outerwearProblems(frame, dims, options);
  if (problems.length > 0) return { shape: null, problems };
  const d = (id: string): number => need(dims, id);
  const hemBand = options.ribHem ? d("hem-band-height") : 0;
  return {
    shape: {
      frame,
      options,
      chest: basis.chest,
      hoodHeight: d("hood-height"),
      hoodHalf: d("hood-width") * HOOD_FRONT_SHARE,
      cuffHeight: options.ribCuffs ? d("cuff-height") : 0,
      hemBand,
      hemTop: basis.length - (options.ribHem ? hemBand : PLAIN_HEM_GAP * basis.chest),
      zipTop: basis.length - d("zip-length"),
      pocketOpening: d("pocket-opening"),
      pocketWidth: d("pocket-width"),
      pocketHeight: d("pocket-height"),
    },
    problems,
  };
}

/** Every problem with a set of dimensions, for either view. */
export function outerwearFitProblems(dims: Dims, options: OuterwearOptions): readonly string[] {
  return outerwearShapeOf(dims, options, "front").problems;
}

/** The x of the side seam at height y, between the underarm and the hem. */
export function sideAt(shape: OuterwearShape, y: number): number {
  const { underarm, length, halfHem } = shape.frame.basis;
  const share = (y - underarm.y) / (length - underarm.y);
  return underarm.x + (halfHem - underarm.x) * share;
}

/** The top of the hood on the right: from the neck seam at the shoulder, out and up to the crown. */
export function hoodDome(shape: OuterwearShape): Chain {
  const { seamX } = shape.frame.basis;
  const { hoodHalf, hoodHeight } = shape;
  const widest = pt(hoodHalf, -hoodHeight * 0.45);
  return chain(
    pt(seamX, 0),
    curveTo(pt(seamX + (hoodHalf - seamX) * 0.6, -hoodHeight * 0.05), pt(hoodHalf, -hoodHeight * 0.22), widest),
    curveTo(pt(hoodHalf, -hoodHeight * 0.78), pt(hoodHalf * 0.55, -hoodHeight), pt(0, -hoodHeight)),
  );
}

/** The hood: the dome over the head, closed along the neck seam of the body. */
export function hoodOutline(shape: OuterwearShape): Chain {
  return joinChains(reverseChain(bothSides(neckSeam(shape.frame))), bothSides(hoodDome(shape)));
}

/** The opening for the face, seen from the front: where the lining or the inside of the hood shows. */
export function faceOpening(shape: OuterwearShape): Chain {
  const { hoodHalf, hoodHeight, frame } = shape;
  const half = hoodHalf * FACE_SHARE;
  const bottom = frame.drop;
  const top = -hoodHeight * 0.84;
  const right = chain(
    pt(0, bottom),
    curveTo(pt(half * 0.55, bottom - hoodHeight * 0.08), pt(half, -hoodHeight * 0.12), pt(half, -hoodHeight * 0.42)),
    curveTo(pt(half, -hoodHeight * 0.66), pt(half * 0.55, top), pt(0, top)),
  );
  return joinChains(right, reverseChain(mirrorChain(right)));
}

/** A band across the bottom of the body, from where it starts down to the hem. */
export function hemBandOutline(shape: OuterwearShape): Chain {
  const { length, halfHem } = shape.frame.basis;
  const top = shape.hemTop;
  const x = sideAt(shape, top);
  return chain(pt(-x, top), lineTo(pt(x, top)), lineTo(pt(halfHem, length)), lineTo(pt(-halfHem, length)));
}

/** The kangaroo pocket: a straight top, slanted open sides and a bottom on the hem band. */
export function kangarooOutline(shape: OuterwearShape): Chain {
  const bottom = shape.hemTop;
  const top = bottom - shape.pocketHeight;
  const half = shape.pocketWidth / 2;
  const topHalf = half * 0.62;
  const right = chain(pt(0, top), lineTo(pt(topHalf, top)), curveTo(pt(topHalf + (half - topHalf) * 0.2, top + shape.pocketHeight * 0.55), pt(half, bottom - shape.pocketHeight * 0.2), pt(half, bottom)), lineTo(pt(0, bottom)));
  return joinChains(right, reverseChain(mirrorChain(right)));
}

/** The sleeves and cuffs. In the front view the wearer's left sleeve is on the right of the page. */
export function sleevePieces(shape: OuterwearShape): { left: Chain; right: Chain; cuffs: Chain[] } {
  const { sleeve, cuff } = sleeveChains(shape.frame, shape.cuffHeight);
  const mirrored = mirrorChain(sleeve);
  const cuffs = cuff ? [cuff, mirrorChain(cuff)] : [];
  return shape.frame.view === "front" ? { left: sleeve, right: mirrored, cuffs } : { left: mirrored, right: sleeve, cuffs };
}

/** The whole garment as one outline: body, sleeves, and the hood above the neck when there is one. */
export function hoodedSilhouette(shape: OuterwearShape): Chain {
  const { basis, options } = shape.frame;
  const { topEnd, lowerEnd } = sleeveEnds(basis);
  const shoulder = options.raglan ? [] : [lineTo(basis.top)];
  const right = chain(pt(basis.seamX, 0), ...shoulder, lineTo(topEnd), lineTo(lowerEnd), lineTo(basis.underarm), lineTo(pt(basis.halfHem, basis.length)), lineTo(pt(0, basis.length)));
  return joinChains(right, reverseChain(mirrorChain(right)), mirrorChain(hoodDome(shape)), reverseChain(hoodDome(shape)));
}
