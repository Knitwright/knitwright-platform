import { chain, lineTo, mirrorChain, openCommands, pt, type Chain } from "../chain";
import type { FlatPath } from "../model";
import { seamPath, stitchPath } from "../paths";
import { CUFF_HEIGHT, HEM_STITCH_GAP } from "./basis";
import { placketTop } from "./collar";
import { sidePanelOnRight } from "./side-panels";
import { armholeChain, bothSides, hemLift, hemSegment, neckOpening, neckSeam, sleeveChains, sleeveEnds, type Frame } from "./pieces";

const both = (name: string, right: Chain, build: (name: string, commands: ReturnType<typeof openCommands>) => FlatPath): FlatPath[] => [
  build(`${name}, right`, openCommands(right)),
  build(`${name}, left`, openCommands(mirrorChain(right))),
];

/** The lines where pieces are sewn together, drawn solid. */
export function seamLines(frame: Frame): FlatPath[] {
  const { basis, options } = frame;
  const side = pt(basis.halfHem, basis.length - hemLift(frame, basis.halfHem));
  const lines = [
    ...both("Armhole seam", armholeChain(frame), seamPath),
    ...both("Side seam", chain(basis.underarm, lineTo(side)), seamPath),
    ...both("Underarm seam", chain(basis.underarm, lineTo(sleeveEnds(basis).lowerEnd)), seamPath),
  ];
  if (!options.raglan) lines.push(...both("Shoulder seam", chain(pt(basis.seamX, 0), lineTo(basis.top)), seamPath));
  if (options.collar === "none") lines.push(seamPath("Neckband seam", openCommands(bothSides(neckSeam(frame)))));
  if (options.cuffs) lines.push(...cuffSeams(frame));
  if (options.sidePanels) lines.push(...sideStripSeams(frame));
  return lines;
}

function cuffSeams(frame: Frame): FlatPath[] {
  const { cuff } = sleeveChains(frame, CUFF_HEIGHT * frame.basis.chest);
  if (!cuff) return [];
  const start = cuff.start;
  const end = cuff.pieces[2]?.to ?? start;
  return both("Cuff seam", chain(start, lineTo(end)), seamPath);
}

function sideStripSeams(frame: Frame): FlatPath[] {
  return both("Side panel seam", sidePanelOnRight(frame).inner, seamPath);
}

/** The rows of stitching a factory would sew, drawn dashed. */
export function stitchLines(frame: Frame): FlatPath[] {
  const { basis, options } = frame;
  const gap = HEM_STITCH_GAP * basis.chest;
  const lines: FlatPath[] = [
    stitchPath("Hem stitching", openCommands(hemSegment(frame, -basis.halfHem, basis.halfHem, gap))),
  ];
  if (!options.cuffs) {
    const { topEnd, lowerEnd } = sleeveEnds(basis);
    const back = (p: { x: number; y: number }) => pt(p.x - basis.along.x * gap, p.y - basis.along.y * gap);
    lines.push(...both("Sleeve hem stitching", chain(back(topEnd), lineTo(back(lowerEnd))), stitchPath));
  }
  if (options.collar === "none") lines.push(stitchPath("Neckline stitching", openCommands(bothSides(midNeck(frame)))));
  if (options.placket !== "none" && frame.view === "front") lines.push(placketStitching(frame));
  return lines;
}

function midNeck(frame: Frame): Chain {
  const opening = neckOpening(frame);
  const seam = neckSeam(frame);
  const middle = (a: number, b: number): number => (a + b) / 2;
  const start = pt(middle(opening.start.x, seam.start.x), middle(opening.start.y, seam.start.y));
  const pieces = opening.pieces.map((piece, index) => {
    const other = seam.pieces[index] ?? piece;
    return {
      ...(piece.c1 && piece.c2 && other.c1 && other.c2
        ? {
            c1: pt(middle(piece.c1.x, other.c1.x), middle(piece.c1.y, other.c1.y)),
            c2: pt(middle(piece.c2.x, other.c2.x), middle(piece.c2.y, other.c2.y)),
          }
        : {}),
      to: pt(middle(piece.to.x, other.to.x), middle(piece.to.y, other.to.y)),
    };
  });
  return { start, pieces };
}

function placketStitching(frame: Frame): FlatPath {
  const inset = frame.placketWidth * 0.18;
  const top = placketTop(frame);
  const bottom = top + frame.placketLength;
  const half = frame.placketWidth / 2 - inset;
  const outline = chain(pt(-half, top), lineTo(pt(-half, bottom - inset)), lineTo(pt(half, bottom - inset)), lineTo(pt(half, top)));
  return stitchPath("Placket stitching", openCommands(outline));
}
