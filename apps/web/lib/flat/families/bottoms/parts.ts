import { chain, circle, closedCommands, curveTo, lineTo, mirrorChain, openCommands, pt, type Chain } from "../../chain";
import type { FlatPath, Point, View } from "../../model";
import { detailPath, panelPath, seamPath, stitchPath } from "../../paths";
import type { DrawContext, Ends } from "../drawing";
import type { BottomsOptions } from "./options";
import {
  GUSSET_SIZE,
  cuffOutline,
  gussetOutline,
  insideEdgeUp,
  legEdgesAt,
  legsOutline,
  outsideEdge,
  stripeOutline,
  stripeSeam,
  waistbandOutline,
  type BottomsBasis,
} from "./shape";

/** Shares of the hip width. */
const STITCH_GAP = 0.018;
const EYELET_RADIUS = 0.009;
const CORD_DROP = 0.2;
const POCKET_INSET = 0.035;
const POCKET_TOP = 0.03;
const POCKET_LENGTH = 0.2;
const ZIP_TAB = 0.011;
const WHITE = "#ffffff";

const both = (name: string, right: Chain, build: (name: string, commands: ReturnType<typeof openCommands>) => FlatPath): FlatPath[] => [
  build(`${name}, right`, openCommands(right)),
  build(`${name}, left`, openCommands(mirrorChain(right))),
];

/** Every panel this view shows, legs first and what lies on them after. */
export function bottomsPanels(context: DrawContext, basis: BottomsBasis, options: BottomsOptions): FlatPath[] {
  const legsId = `legs-${context.view}`;
  const stripe = stripeOutline(basis);
  const cuff = cuffOutline(basis);
  const pieces: [string, readonly Chain[] | null][] = [
    [legsId, [legsOutline(basis)]],
    ["waistband", [waistbandOutline(basis)]],
    ["gusset", options.gusset ? [gussetOutline(basis)] : null],
    ["side-stripes", options.stripe ? [stripe, mirrorChain(stripe)] : null],
    ["cuffs", options.legFinish === "rib-cuff" ? [cuff, mirrorChain(cuff)] : null],
  ];
  return pieces.flatMap(([panelId, chains]) =>
    chains && context.wanted(panelId)
      ? [panelPath(context.nameOf(panelId), panelId, closedCommands(...chains), context.fillOf(panelId))]
      : [],
  );
}

/** The lines where pieces are sewn together. */
export function bottomsSeams(view: View, basis: BottomsBasis, options: BottomsOptions): FlatPath[] {
  const { bandHeight, bandBottomHalf, crotchY, bottomY } = basis;
  const riseEnd = options.gusset && view === "front" ? crotchY - GUSSET_SIZE * 1.6 * basis.hip : crotchY;
  const lines: FlatPath[] = [
    seamPath("Waistband seam", openCommands(chain(pt(-bandBottomHalf, bandHeight), lineTo(pt(bandBottomHalf, bandHeight))))),
    seamPath(view === "front" ? "Front rise seam" : "Back rise seam", openCommands(chain(pt(0, bandHeight), lineTo(pt(0, riseEnd))))),
    ...both("Inside leg seam", insideEdgeUp(basis, bottomY), seamPath),
    ...(options.stripe ? both("Side stripe seam", stripeSeam(basis), seamPath) : both("Outside leg seam", outsideEdge(basis, bottomY), seamPath)),
  ];
  if (options.legFinish === "rib-cuff") {
    const top = legEdgesAt(basis, bottomY);
    lines.push(...both("Cuff seam", chain(pt(top.inner, bottomY), lineTo(pt(top.outer, bottomY))), seamPath));
  }
  return lines;
}

/** The rows of stitching, drawn dashed. */
export function bottomsStitching(basis: BottomsBasis, options: BottomsOptions): FlatPath[] {
  const gap = STITCH_GAP * basis.hip;
  const lines: FlatPath[] = [];
  if (options.waistband !== "wide-band") {
    const y = basis.bandHeight - gap;
    const half = basis.waistHalf + (basis.bandBottomHalf - basis.waistHalf) * (y / basis.bandHeight);
    lines.push(stitchPath("Waistband stitching", openCommands(chain(pt(-half, y), lineTo(pt(half, y))))));
  }
  if (options.legFinish !== "rib-cuff") {
    const y = basis.hemY - gap;
    const edges = legEdgesAt(basis, y);
    lines.push(...both("Leg hem stitching", chain(pt(edges.inner, y), lineTo(pt(edges.outer, y))), stitchPath));
  }
  return lines;
}

function drawcord(basis: BottomsBasis): FlatPath[] {
  const radius = EYELET_RADIUS * basis.hip;
  const eyelet = pt(0.035 * basis.hip, basis.bandHeight * 0.45);
  const end = pt(0.055 * basis.hip, basis.bandHeight + CORD_DROP * basis.hip);
  const cord = chain(eyelet, curveTo(pt(eyelet.x, eyelet.y + 0.08 * basis.hip), pt(end.x - 0.02 * basis.hip, end.y - 0.06 * basis.hip), end));
  return [
    detailPath("Drawcord eyelets", closedCommands(circle(eyelet, radius), circle(pt(-eyelet.x, eyelet.y), radius)), WHITE),
    ...both("Drawcord", cord, (name, commands) => detailPath(name, commands)),
  ];
}

/** The opening of the pocket on the right, just inside the outside seam, below the waistband. */
function pocketLine(basis: BottomsBasis): Chain {
  const inset = POCKET_INSET * basis.hip;
  const top = basis.bandHeight + POCKET_TOP * basis.hip;
  const bottom = Math.min(top + POCKET_LENGTH * basis.hip, basis.crotchY);
  const x = (y: number): number => basis.bandBottomHalf + (basis.hipHalf - basis.bandBottomHalf) * Math.min(1, (y - basis.bandHeight) / (basis.hipY - basis.bandHeight)) - inset;
  return chain(pt(x(top) - inset, top), lineTo(pt(x(bottom), bottom)));
}

/** A zip along a line: the teeth, and a pull tab at its top. */
function zipAlong(name: string, line: Chain, size: number): FlatPath[] {
  const start = line.start;
  const tab = chain(pt(start.x - size, start.y), lineTo(pt(start.x + size, start.y)), lineTo(pt(start.x + size, start.y + 2 * size)), lineTo(pt(start.x - size, start.y + 2 * size)));
  return [
    ...both(`${name} teeth`, line, (label, commands) => detailPath(label, commands)),
    detailPath(`${name} pull, right`, closedCommands(tab), WHITE),
    detailPath(`${name} pull, left`, closedCommands(mirrorChain(tab)), WHITE),
  ];
}

function ankleZipLine(basis: BottomsBasis): Chain {
  const inset = POCKET_INSET * basis.hip;
  const top = basis.hemY - 0.22 * basis.inseam;
  const edgesTop = legEdgesAt(basis, top);
  return chain(pt(edgesTop.outer - inset, top), lineTo(pt(basis.hemOuter - inset, basis.hemY)));
}

/** Everything sewn on that is neither a panel nor stitching: drawcord, pockets and zips. */
export function bottomsDetails(view: View, basis: BottomsBasis, options: BottomsOptions): FlatPath[] {
  const size = ZIP_TAB * basis.hip;
  const front = view === "front";
  const cord = front && options.waistband === "elastic-drawcord" ? drawcord(basis) : [];
  const pockets =
    front && options.pockets === "side-seam"
      ? both("Pocket opening", pocketLine(basis), (name, commands) => detailPath(name, commands))
      : front && options.pockets === "zip-side"
        ? zipAlong("Pocket zip", pocketLine(basis), size)
        : [];
  const ankle = options.legFinish === "ankle-zip" ? zipAlong("Ankle zip", ankleZipLine(basis), size) : [];
  return [...cord, ...pockets, ...ankle];
}

/** Where a named place on a panel is. The wearer's left is on the right of the page from the front. */
export function bottomsAnchor(view: View, basis: BottomsBasis, panelId: string, anchorId: string): Point | null {
  const thighY = basis.crotchY + 0.18 * basis.inseam;
  const lowerY = basis.crotchY + 0.62 * basis.inseam;
  const centreAt = (y: number): number => {
    const edges = legEdgesAt(basis, y);
    return (edges.inner + edges.outer) / 2;
  };
  const side = view === "front" ? 1 : -1;
  const table: Readonly<Record<string, Point>> = {
    "legs-front:left-thigh": pt(centreAt(thighY), thighY),
    "legs-front:right-thigh": pt(-centreAt(thighY), thighY),
    "legs-front:left-lower-leg": pt(centreAt(lowerY), lowerY),
    "legs-front:right-lower-leg": pt(-centreAt(lowerY), lowerY),
    "legs-back:centre-back-waist": pt(0, basis.bandHeight + 0.1 * basis.hip),
    "legs-back:left-back-thigh": pt(side * centreAt(thighY), thighY),
    "legs-back:right-back-thigh": pt(-side * centreAt(thighY), thighY),
  };
  return table[`${panelId}:${anchorId}`] ?? null;
}

/** The two ends of the line that shows each point of measure, or null when this view does not show it. */
export function bottomsCalloutEnds(view: View, basis: BottomsBasis, pointId: string): Ends | null {
  const { hip, waistHalf, stretchedHalf, bandHeight, hipHalf, hipY, crotchY, hemY } = basis;
  const outer = Math.max(hipHalf, basis.thighOuter, basis.hemOuter) + 0.08 * hip;
  const kneeLine: Ends | null = basis.knee ? [pt(basis.knee.inner, basis.knee.y), pt(basis.knee.outer, basis.knee.y)] : null;
  const table: Readonly<Record<string, Ends | null>> = {
    "waist-relaxed": [pt(-waistHalf, -0.05 * hip), pt(waistHalf, -0.05 * hip)],
    "waist-stretched": [pt(-stretchedHalf, -0.14 * hip), pt(stretchedHalf, -0.14 * hip)],
    "waistband-height": [pt(waistHalf + 0.05 * hip, 0), pt(waistHalf + 0.05 * hip, bandHeight)],
    hip: [pt(-hipHalf, hipY), pt(hipHalf, hipY)],
    "front-rise": view === "front" ? [pt(0, 0), pt(0, crotchY)] : null,
    "back-rise": view === "back" ? [pt(0, 0), pt(0, crotchY)] : null,
    thigh: [pt(0, crotchY + 0.03 * hip), pt(basis.thighOuter, crotchY + 0.03 * hip)],
    knee: kneeLine,
    "leg-opening": [pt(basis.hemInner, hemY + 0.05 * hip), pt(basis.hemOuter, hemY + 0.05 * hip)],
    inseam: [pt(0, crotchY), pt(basis.hemInner, hemY)],
    outseam: [pt(-outer, 0), pt(-outer, hemY)],
  };
  return table[pointId] ?? null;
}
