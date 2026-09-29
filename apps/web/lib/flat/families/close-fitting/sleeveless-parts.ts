import { chain, closedCommands, joinChains, lineTo, mirrorChain, openCommands, pt, reverseChain, shiftChain, type Chain } from "../../chain";
import type { FlatPath, Point } from "../../model";
import { panelPath, seamPath, stitchPath } from "../../paths";
import type { DrawContext, Ends } from "../drawing";
import {
  armholeBinding,
  armholeBindingSeam,
  armholeEdge,
  neckBinding,
  neckEdge,
  sideAt,
  sleevelessOutline,
  underbandOutline,
  type SleevelessShape,
} from "./sleeveless";

/** Shares of the chest width. */
const STITCH_GAP = 0.015;
const FLAT_SEAM_GAP = 0.008;

const both = (name: string, right: Chain, build: (name: string, commands: ReturnType<typeof openCommands>) => FlatPath): FlatPath[] => [
  build(`${name}, right`, openCommands(right)),
  build(`${name}, left`, openCommands(mirrorChain(right))),
];

/** Every panel this view shows: the body, then the underband and the binding on it. */
export function sleevelessPanels(context: DrawContext, shape: SleevelessShape): FlatPath[] {
  const bodyId = `body-${context.view}`;
  const armhole = armholeBinding(shape);
  const pieces: [string, readonly Chain[] | null][] = [
    [bodyId, [sleevelessOutline(shape)]],
    ["underband", shape.options.underband ? [underbandOutline(shape)] : null],
    ["binding", shape.options.edge === "bound" ? [neckBinding(shape), armhole, mirrorChain(armhole)] : null],
  ];
  return pieces.flatMap(([panelId, chains]) =>
    chains && context.wanted(panelId)
      ? [panelPath(context.nameOf(panelId), panelId, closedCommands(...chains), context.fillOf(panelId))]
      : [],
  );
}

/** The bottom of the side seam: the hem, or the top of the underband. */
const sideBottom = (shape: SleevelessShape): number => shape.length - shape.band;

/** The lines where pieces are sewn together. */
export function sleevelessSeams(shape: SleevelessShape): FlatPath[] {
  const bottom = sideBottom(shape);
  const lines: FlatPath[] = [
    ...both("Shoulder seam", chain(pt(shape.neckHalf, 0), lineTo(shape.strapTop)), seamPath),
    ...both("Side seam", chain(shape.underarm, lineTo(pt(sideAt(shape, bottom), bottom))), seamPath),
  ];
  if (shape.options.underband) {
    const x = sideAt(shape, bottom);
    lines.push(seamPath("Underband seam", openCommands(chain(pt(-x, bottom), lineTo(pt(x, bottom))))));
  }
  if (shape.options.edge === "bound") {
    const b = shape.binding;
    lines.push(seamPath("Neck binding seam", openCommands(shiftedNeck(shape, b))));
    lines.push(...both("Armhole binding seam", armholeBindingSeam(shape), seamPath));
  }
  return lines;
}

/** The neck edge moved down into the body, both sides. */
function shiftedNeck(shape: SleevelessShape, distance: number): Chain {
  const right = shiftChain(neckEdge(shape), 0, distance);
  return joinChains(right, reverseChain(mirrorChain(right)));
}

/** The rows of stitching: the hem, turned or elastic edges, and both sides of flat seams. */
export function sleevelessStitching(shape: SleevelessShape): FlatPath[] {
  const gap = STITCH_GAP * shape.chest;
  const lines: FlatPath[] = [];
  if (!shape.options.underband) {
    const y = shape.length - gap * 1.5;
    lines.push(stitchPath("Hem stitching", openCommands(chain(pt(-sideAt(shape, y), y), lineTo(pt(sideAt(shape, y), y))))));
  }
  if (shape.options.edge !== "bound") {
    const name = shape.options.edge === "elastic" ? "Elastic edge stitching" : "Edge stitching";
    lines.push(stitchPath(`Neck ${name.toLowerCase()}`, openCommands(shiftedNeck(shape, gap))));
    lines.push(...both(`Armhole ${name.toLowerCase()}`, shiftChain(armholeEdge(shape), -gap * 0.8, gap * 0.8), stitchPath));
  }
  if (shape.options.flatSeams) {
    const flat = FLAT_SEAM_GAP * shape.chest;
    const bottom = sideBottom(shape);
    // The side seam is the edge of the flat, so both rows of a flat seam show just inside it.
    for (const [row, offset] of [["outer", -flat], ["inner", -flat * 2.5]] as const) {
      const line = chain(pt(shape.underarm.x + offset, shape.underarm.y), lineTo(pt(sideAt(shape, bottom) + offset, bottom)));
      lines.push(...both(`Flat seam stitching, ${row} row`, line, stitchPath));
    }
  }
  return lines;
}

/** Where a named place on a panel is. The wearer's left is on the right of the page from the front. */
export function sleevelessAnchor(shape: SleevelessShape, panelId: string, anchorId: string): Point | null {
  const chestLine = shape.underarm.y;
  const below = chestLine + 0.45 * (shape.length - shape.band - chestLine);
  const centre = Math.max(shape.drop + 0.08 * shape.chest, 0.7 * chestLine);
  const table: Readonly<Record<string, Point>> = {
    "body-front:centre-chest": pt(0, centre),
    "body-front:left-chest": pt(0.2 * shape.chest, centre),
    "body-front:right-chest": pt(-0.2 * shape.chest, centre),
    "body-front:lower-front": pt(0, below),
    "body-back:upper-back": pt(0, shape.drop + 0.06 * shape.chest),
    "body-back:centre-back": pt(0, centre),
    "body-back:lower-back": pt(0, below),
  };
  return table[`${panelId}:${anchorId}`] ?? null;
}

/** The ends of the line that shows each point of measure, or null when this view does not show it. */
export function sleevelessCalloutEnds(shape: SleevelessShape, pointId: string): Ends | null {
  const { chest, neckHalf, strapTop, underarm, length, hemHalf, view } = shape;
  const front = view === "front";
  const table: Readonly<Record<string, Ends | null>> = {
    "chest-width": [pt(-underarm.x, underarm.y), underarm],
    "body-length": [pt(-(Math.max(underarm.x, hemHalf) + 0.06 * chest), 0), pt(-(Math.max(underarm.x, hemHalf) + 0.06 * chest), length)],
    "hem-width": [pt(-hemHalf, length + 0.05 * chest), pt(hemHalf, length + 0.05 * chest)],
    underbust: [pt(-hemHalf, length + 0.05 * chest), pt(hemHalf, length + 0.05 * chest)],
    "neck-width": [pt(-neckHalf, -0.05 * chest), pt(neckHalf, -0.05 * chest)],
    "front-neck-drop": front ? [pt(0, 0), pt(0, shape.drop)] : null,
    "back-neck-drop": front ? null : [pt(0, 0), pt(0, shape.drop)],
    "armhole-depth": [pt(underarm.x + 0.05 * chest, 0), pt(underarm.x + 0.05 * chest, underarm.y)],
    "strap-width": [pt(neckHalf, -0.03 * chest), pt(strapTop.x, strapTop.y - 0.03 * chest)],
    "back-width-narrowest": shape.narrow ? [pt(-shape.narrow.x, shape.narrow.y), shape.narrow] : null,
  };
  return table[pointId] ?? null;
}
