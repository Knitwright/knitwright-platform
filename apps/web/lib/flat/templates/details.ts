import { chain, circle, closedCommands, lineTo, mirrorChain, openCommands, pt, type Chain } from "../chain";
import { DETAIL_COLOUR, brightness } from "../colour";
import type { FlatPath } from "../model";
import { detailPath } from "../paths";
import { placketTop } from "./collar";
import { poloFoldLine, poloTipDepth } from "./polo-collar";
import { hemLift, type Frame } from "./pieces";

/** Shares of the chest width. */
const BUTTON_SPACING = 0.09;
const BUTTON_RADIUS = 0.02;
const MIN_BUTTONS = 2;
const MAX_BUTTONS = 6;
const VENT_HEIGHT = 0.1;
const VENT_INSET = 0.02;
const WHITE = "#ffffff";
/** A fold line on a dark collar is drawn light, so that it can be seen. */
const LIGHT_LINE = "#e5e7eb";
const DARK_COLLAR = 300;

/** Where the buttons go: evenly down the placket. On a polo the top one sits just below the collar points. */
function buttonCentres(frame: Frame): { centres: number[]; radius: number } {
  const radius = Math.min(BUTTON_RADIUS * frame.basis.chest, frame.placketWidth * 0.32);
  const top = placketTop(frame);
  const bottom = top + frame.placketLength;
  const spacing = BUTTON_SPACING * frame.basis.chest;
  const tips = frame.options.collar === "polo-collar" ? poloTipDepth(frame) : 0;
  const first = tips > 0 ? top + tips + 1.5 * radius : top + Math.min(spacing, frame.placketLength / 2) / 2;
  const last = Math.max(first, bottom - (tips > 0 ? 1.2 * radius : spacing / 2));
  const count = Math.min(MAX_BUTTONS, Math.max(MIN_BUTTONS, Math.round((last - first) / spacing) + 1));
  return { centres: Array.from({ length: count }, (_, index) => first + ((last - first) * index) / (count - 1)), radius };
}

/** Buttons down the placket. Each is a small circle with a smaller one inside. */
function buttonPaths(frame: Frame): FlatPath[] {
  const { centres, radius } = buttonCentres(frame);
  return centres.map((y, index) =>
    detailPath(`Button ${index + 1}`, closedCommands(circle(pt(0, y), radius), circle(pt(0, y), radius * 0.35)), WHITE),
  );
}

/** A zip: the teeth as two lines and a pull tab at the top. On a band collar it runs through the band to its top edge. */
function zipPaths(frame: Frame, collarFill: string = WHITE): FlatPath[] {
  const top = frame.options.collar === "band-collar" ? frame.drop - frame.collarHeight : placketTop(frame);
  const bottom = placketTop(frame) + frame.placketLength;
  const tooth = frame.placketWidth * 0.12;
  const pull = frame.placketLength * 0.12;
  const tab = chain(
    pt(-tooth * 1.6, top),
    lineTo(pt(tooth * 1.6, top)),
    lineTo(pt(tooth * 1.6, top + pull)),
    lineTo(pt(-tooth * 1.6, top + pull)),
  );
  const colour = frame.options.collar === "band-collar" && brightness(collarFill) < DARK_COLLAR ? LIGHT_LINE : DETAIL_COLOUR;
  return [
    detailPath("Zip teeth, left", openCommands(chain(pt(-tooth, top), lineTo(pt(-tooth, bottom)))), null, colour),
    detailPath("Zip teeth, right", openCommands(chain(pt(tooth, top), lineTo(pt(tooth, bottom)))), null, colour),
    detailPath("Zip pull", closedCommands(tab), WHITE),
  ];
}

/** The fold line of each collar leaf on a polo, seen from the front. */
function foldLines(frame: Frame, collarFill: string): FlatPath[] {
  if (frame.options.collar !== "polo-collar" || frame.view !== "front") return [];
  const right = poloFoldLine(frame);
  const colour = brightness(collarFill) < DARK_COLLAR ? LIGHT_LINE : DETAIL_COLOUR;
  return [
    detailPath("Collar fold line, right", openCommands(right), null, colour),
    detailPath("Collar fold line, left", openCommands(mirrorChain(right)), null, colour),
  ];
}

/** A split at the bottom of each side seam: a short line up the seam and a small bar across it. */
function ventPaths(frame: Frame): FlatPath[] {
  const { basis } = frame;
  const x = basis.halfHem - VENT_INSET * basis.chest;
  const bottom = basis.length - hemLift(frame, x);
  const top = bottom - VENT_HEIGHT * basis.length;
  const bar = VENT_INSET * basis.chest;
  const right: Chain = chain(pt(x, bottom), lineTo(pt(x, top)), lineTo(pt(x - bar, top)));
  return [
    detailPath("Side vent, right", openCommands(right)),
    detailPath("Side vent, left", openCommands(mirrorChain(right))),
  ];
}

/** Everything sewn on or cut into the garment that is neither a panel nor stitching. */
export function detailLines(frame: Frame, collarFill: string = WHITE): FlatPath[] {
  const { options, view } = frame;
  const fastening = view === "front" ? (options.placket === "buttons" ? buttonPaths(frame) : options.placket === "zip" ? zipPaths(frame, collarFill) : []) : [];
  return [...foldLines(frame, collarFill), ...fastening, ...(options.hem === "side-vent" ? ventPaths(frame) : [])];
}
