import { chain, circle, closedCommands, lineTo, mirrorChain, openCommands, pt, type Chain } from "../chain";
import type { FlatPath } from "../model";
import { detailPath } from "../paths";
import { placketTop } from "./collar";
import { hemLift, type Frame } from "./pieces";

/** Shares of the chest width. */
const BUTTON_SPACING = 0.09;
const BUTTON_RADIUS = 0.02;
const MIN_BUTTONS = 2;
const MAX_BUTTONS = 6;
const VENT_HEIGHT = 0.1;
const VENT_INSET = 0.02;
const WHITE = "#ffffff";

/** Buttons down the placket, spaced evenly. Each is a small circle with a smaller one inside. */
export function buttonPaths(frame: Frame): FlatPath[] {
  const count = Math.min(MAX_BUTTONS, Math.max(MIN_BUTTONS, Math.round(frame.placketLength / (BUTTON_SPACING * frame.basis.chest))));
  const radius = Math.min(BUTTON_RADIUS * frame.basis.chest, frame.placketWidth * 0.32);
  const top = placketTop(frame);
  return Array.from({ length: count }, (_, index) => {
    const centre = pt(0, top + (frame.placketLength * (index + 0.5)) / count);
    return detailPath(`Button ${index + 1}`, closedCommands(circle(centre, radius), circle(centre, radius * 0.35)), WHITE);
  });
}

/** A zip: the teeth as two lines, the tape edges, and a pull tab at the top. */
export function zipPaths(frame: Frame): FlatPath[] {
  const top = placketTop(frame);
  const bottom = top + frame.placketLength;
  const tooth = frame.placketWidth * 0.12;
  const pull = frame.placketLength * 0.12;
  const tab = chain(
    pt(-tooth * 1.6, top),
    lineTo(pt(tooth * 1.6, top)),
    lineTo(pt(tooth * 1.6, top + pull)),
    lineTo(pt(-tooth * 1.6, top + pull)),
  );
  return [
    detailPath("Zip teeth, left", openCommands(chain(pt(-tooth, top), lineTo(pt(-tooth, bottom))))),
    detailPath("Zip teeth, right", openCommands(chain(pt(tooth, top), lineTo(pt(tooth, bottom))))),
    detailPath("Zip pull", closedCommands(tab), WHITE),
  ];
}

/** A split at the bottom of each side seam: a short line up the seam and a small bar across it. */
export function ventPaths(frame: Frame): FlatPath[] {
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
export function detailLines(frame: Frame): FlatPath[] {
  const { options, view } = frame;
  const fastening = view === "front" ? (options.placket === "buttons" ? buttonPaths(frame) : options.placket === "zip" ? zipPaths(frame) : []) : [];
  return [...fastening, ...(options.hem === "side-vent" ? ventPaths(frame) : [])];
}
