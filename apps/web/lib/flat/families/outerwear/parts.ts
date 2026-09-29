import { chain, circle, closedCommands, curveTo, lineTo, mirrorChain, openCommands, pt, type Chain } from "../../chain";
import { darken } from "../../colour";
import type { FlatPath, Point } from "../../model";
import { detailPath, insidePath, panelPath, seamPath, stitchPath } from "../../paths";
import { collarChain, neckbandChain, standTop } from "../../templates/collar";
import { insideBackChain } from "../../templates/inside-back";
import { armholeChain, bodyOutline, bothSides, neckSeam, sleeveEnds } from "../../templates/pieces";
import type { DrawContext, Ends } from "../drawing";
import { faceOpening, hemBandOutline, hoodDome, hoodOutline, kangarooOutline, sideAt, sleevePieces, type OuterwearShape } from "./shape";

/** Shares of the chest width. */
const STITCH_GAP = 0.03;
const ZIP_TOOTH = 0.008;
const ZIP_PULL = 0.03;
const EYELET = 0.008;
const CORD_DROP = 0.2;
const POCKET_INSET = 0.06;
const WHITE = "#ffffff";
/** How much of the body colour the inside of a single layer hood keeps. */
const INSIDE_TONE = 0.86;

const both = (name: string, right: Chain, build: (name: string, commands: ReturnType<typeof openCommands>) => FlatPath): FlatPath[] => [
  build(`${name}, right`, openCommands(right)),
  build(`${name}, left`, openCommands(mirrorChain(right))),
];

const detail = (name: string, commands: ReturnType<typeof openCommands>): FlatPath => detailPath(name, commands);

/** Every panel this view shows, in drawing order: body and sleeves, then what lies on them. */
export function outerwearPanels(context: DrawContext, shape: OuterwearShape): FlatPath[] {
  const { frame, options } = shape;
  const view = context.view;
  const bodyId = `body-${view}`;
  const sleeves = sleevePieces(shape);
  const collar = options.collar === "stand" ? collarChain(frame) : null;
  const hood = options.hood !== "none";
  const pieces: [string, readonly Chain[] | null][] = [
    [bodyId, [bodyOutline(frame)]],
    ["sleeve-left", [sleeves.left]],
    ["sleeve-right", [sleeves.right]],
    ["cuffs", sleeves.cuffs.length > 0 ? sleeves.cuffs : null],
    ["hem-band", options.ribHem ? [hemBandOutline(shape)] : null],
    ["kangaroo-pocket", options.pockets === "kangaroo" ? [kangarooOutline(shape)] : null],
    ["neckband", !hood && options.collar === "none" ? [neckbandChain(frame)] : null],
    ["collar", collar ? [collar] : null],
    ["hood", hood ? [hoodOutline(shape)] : null],
    ["hood-lining", options.hood === "lined" ? [faceOpening(shape)] : null],
  ];
  const drawn = pieces.flatMap(([panelId, chains]) =>
    chains && context.wanted(panelId)
      ? [panelPath(context.nameOf(panelId), panelId, closedCommands(...chains), context.fillOf(panelId))]
      : [],
  );
  // Without a lining, the inside of the hood itself shows through the face opening.
  const hoodInside =
    options.hood === "single-layer" && view === "front"
      ? [insidePath("Inside of the hood", closedCommands(faceOpening(shape)), darken(context.fillOf("hood"), INSIDE_TONE))]
      : [];
  // Without a hood, the inside of the back shows through the neck, as on a top.
  const neck = !hood ? insideBackChain(frame) : null;
  const inside = neck ? [insidePath("Inside of the neck", closedCommands(neck), darken(context.fillOf(bodyId), INSIDE_TONE))] : [];
  return [...inside, ...drawn, ...hoodInside];
}

/** The lines where pieces are sewn together. */
export function outerwearSeams(shape: OuterwearShape): FlatPath[] {
  const { frame, options } = shape;
  const { basis } = frame;
  const hood = options.hood !== "none";
  const bottom = options.ribHem ? shape.hemTop : basis.length;
  const lines: FlatPath[] = [
    ...both(options.raglan ? "Raglan seam" : "Armhole seam", armholeChain(frame), seamPath),
    ...both("Side seam", chain(basis.underarm, lineTo(pt(sideAt(shape, bottom), bottom))), seamPath),
    ...both("Underarm seam", chain(basis.underarm, lineTo(sleeveEnds(basis).lowerEnd)), seamPath),
  ];
  if (!options.raglan) lines.push(...both("Shoulder seam", chain(pt(basis.seamX, 0), lineTo(basis.top)), seamPath));
  const neckName = hood ? "Hood seam" : options.collar === "stand" ? "Collar seam" : "Neckband seam";
  if (options.collar !== "stand") lines.push(seamPath(neckName, openCommands(bothSides(neckSeam(frame)))));
  if (hood && frame.view === "back") {
    lines.push(seamPath("Hood centre seam", openCommands(chain(pt(0, -shape.hoodHeight), lineTo(pt(0, frame.drop + basis.band))))));
  }
  if (options.ribHem) {
    const x = sideAt(shape, shape.hemTop);
    lines.push(seamPath("Hem band seam", openCommands(chain(pt(-x, shape.hemTop), lineTo(pt(x, shape.hemTop))))));
  }
  if (options.ribCuffs) {
    const [cuff] = sleevePieces(shape).cuffs;
    if (cuff) lines.push(...both("Cuff seam", chain(cuff.start, lineTo(cuff.pieces[2]?.to ?? cuff.start)), seamPath));
  }
  return lines;
}

/** The rows of stitching, drawn dashed. */
export function outerwearStitching(shape: OuterwearShape): FlatPath[] {
  const { frame, options } = shape;
  const { basis } = frame;
  const gap = STITCH_GAP * basis.chest;
  const lines: FlatPath[] = [];
  if (!options.ribHem) {
    const y = basis.length - gap;
    lines.push(stitchPath("Hem stitching", openCommands(chain(pt(-sideAt(shape, y), y), lineTo(pt(sideAt(shape, y), y))))));
  }
  if (!options.ribCuffs) {
    const { topEnd, lowerEnd } = sleeveEnds(basis);
    const back = (p: Point): Point => pt(p.x - basis.along.x * gap, p.y - basis.along.y * gap);
    lines.push(...both("Sleeve hem stitching", chain(back(topEnd), lineTo(back(lowerEnd))), stitchPath));
  }
  if (options.hood === "single-layer" && frame.view === "front") {
    lines.push(stitchPath("Hood opening stitching", closedCommands(scaled(faceOpening(shape), 1.06))));
  }
  if (options.pockets === "kangaroo" && frame.view === "front") {
    const top = shape.hemTop - shape.pocketHeight + gap * 0.5;
    const half = (shape.pocketWidth / 2) * 0.62 - gap * 0.5;
    lines.push(stitchPath("Pocket stitching", openCommands(chain(pt(-half, top), lineTo(pt(half, top))))));
  }
  return lines;
}

/** A chain grown about the centre of its box, used for stitching just outside an edge. */
function scaled(item: Chain, factor: number): Chain {
  const points = [item.start, ...item.pieces.map((piece) => piece.to)];
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  const middle = (top + bottom) / 2;
  const grow = (point: Point): Point => pt(point.x * factor, middle + (point.y - middle) * factor);
  return {
    start: grow(item.start),
    pieces: item.pieces.map((piece) => ({ ...(piece.c1 && piece.c2 ? { c1: grow(piece.c1), c2: grow(piece.c2) } : {}), to: grow(piece.to) })),
  };
}

/** The zip down the centre front: teeth, and a pull at the top. */
function frontZip(shape: OuterwearShape): FlatPath[] {
  const { basis } = shape.frame;
  const tooth = ZIP_TOOTH * basis.chest;
  const pull = ZIP_PULL * basis.chest;
  const top = shape.zipTop;
  const tab = chain(pt(-tooth * 1.8, top), lineTo(pt(tooth * 1.8, top)), lineTo(pt(tooth * 1.8, top + pull)), lineTo(pt(-tooth * 1.8, top + pull)));
  return [
    ...both("Zip teeth", chain(pt(tooth, top), lineTo(pt(tooth, basis.length))), detail),
    detailPath("Zip pull", closedCommands(tab), WHITE),
  ];
}

/** Cords that come out of the hood at the bottom of the face opening and hang down the chest. */
function hoodCords(shape: OuterwearShape): FlatPath[] {
  const { chest } = shape;
  const start = pt(shape.hoodHalf * 0.2, shape.frame.drop - 0.05 * chest);
  const end = pt(start.x + 0.02 * chest, start.y + CORD_DROP * chest);
  const cord = chain(start, curveTo(pt(start.x, start.y + 0.08 * chest), pt(end.x, end.y - 0.08 * chest), end));
  return [
    detailPath("Drawcord eyelets", closedCommands(circle(start, EYELET * chest), circle(pt(-start.x, start.y), EYELET * chest)), WHITE),
    ...both("Drawcord", cord, detail),
  ];
}

/** The opening of a side pocket on the right front: a slanted line, or a zip, near the side seam. */
function sidePocket(shape: OuterwearShape): Chain {
  const bottom = shape.hemTop - 0.04 * shape.chest;
  const top = bottom - shape.pocketOpening;
  const inset = POCKET_INSET * shape.chest;
  return chain(pt(sideAt(shape, top) - inset * 1.8, top), lineTo(pt(sideAt(shape, bottom) - inset, bottom)));
}

/** Everything sewn on that is neither a panel nor stitching: zip, drawcord and pockets. */
export function outerwearDetails(shape: OuterwearShape): FlatPath[] {
  const { options, frame } = shape;
  if (frame.view !== "front") return [];
  const zip = options.fullZip ? frontZip(shape) : [];
  const cords = options.drawcord && options.hood !== "none" ? hoodCords(shape) : [];
  const tooth = ZIP_TOOTH * shape.chest;
  const pocket = sidePocket(shape);
  const pockets =
    options.pockets === "side-seam"
      ? both("Pocket opening", pocket, detail)
      : options.pockets === "zip-side"
        ? [
            ...both("Pocket zip", pocket, detail),
            ...both("Pocket zip pull", chain(pocket.start, lineTo(pt(pocket.start.x + tooth * 3, pocket.start.y + tooth * 5))), detail),
          ]
        : [];
  return [...zip, ...cords, ...pockets];
}

/** The two ends of the callout line of each point outerwear adds to a top. Null when this view does not show it. */
export function outerwearCalloutEnds(shape: OuterwearShape, pointId: string): Ends | null {
  const { frame, chest, hoodHeight, hoodHalf } = shape;
  const { basis } = frame;
  const front = frame.view === "front";
  const pocketBottom = shape.hemTop;
  const pocketTop = pocketBottom - shape.pocketHeight;
  const side = sidePocket(shape);
  const kangaroo = shape.options.pockets === "kangaroo";
  const { topEnd } = sleeveEnds(basis);
  const cuffStart = pt(topEnd.x - basis.along.x * shape.cuffHeight, topEnd.y - basis.along.y * shape.cuffHeight);
  const table: Readonly<Record<string, Ends | null>> = {
    "hood-height": [pt(hoodHalf + 0.05 * chest, 0), pt(hoodHalf + 0.05 * chest, -hoodHeight)],
    "hood-width": [pt(-hoodHalf, -hoodHeight * 0.45), pt(hoodHalf, -hoodHeight * 0.45)],
    "zip-length": front ? [pt(0.04 * chest, shape.zipTop), pt(0.04 * chest, basis.length)] : null,
    "pocket-opening": front ? (kangaroo ? [pt((shape.pocketWidth / 2) * 0.62, pocketTop), pt(shape.pocketWidth / 2, pocketBottom)] : [side.start, side.pieces[0]?.to ?? side.start]) : null,
    "pocket-width": front ? [pt(-shape.pocketWidth / 2, pocketBottom - 0.03 * chest), pt(shape.pocketWidth / 2, pocketBottom - 0.03 * chest)] : null,
    "pocket-height": front ? [pt(-0.04 * chest, pocketTop), pt(-0.04 * chest, pocketBottom)] : null,
    "cuff-height": [cuffStart, topEnd],
    "hem-band-height": [pt(-basis.halfHem - 0.05 * chest, shape.hemTop), pt(-basis.halfHem - 0.05 * chest, basis.length)],
  };
  return table[pointId] ?? null;
}

/** The standing collar's top edge, for landmarks. */
export const collarTop = (shape: OuterwearShape): Point => standTop(shape.frame, shape.frame.collarHeight).pieces.at(-1)?.to ?? pt(0, 0);

/** The crown of the hood, for landmarks. */
export const hoodCrown = (shape: OuterwearShape): Point => hoodDome(shape).pieces.at(-1)?.to ?? pt(0, 0);
