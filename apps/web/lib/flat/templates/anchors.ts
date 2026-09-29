import { pt } from "../chain";
import type { Point } from "../model";
import { sleeveEnds, type Frame } from "./pieces";

/** Where on the drawing a named place on a panel is. Null for a place the drawing does not know. */
export function anchorPoint(frame: Frame, panelId: string, anchorId: string): Point | null {
  const { basis } = frame;
  const chestLine = basis.underarm.y;
  const below = chestLine + 0.45 * (basis.length - chestLine);
  const side = 0.45 * basis.halfChest;
  const table: Readonly<Record<string, Point>> = {
    "body-front:centre-chest": pt(0, 0.62 * chestLine),
    "body-front:left-chest": pt(side, 0.55 * chestLine),
    "body-front:right-chest": pt(-side, 0.55 * chestLine),
    "body-front:lower-front": pt(0, below),
    "body-back:upper-back": pt(0, 0.45 * chestLine),
    "body-back:centre-back": pt(0, 0.62 * chestLine),
    "body-back:lower-back": pt(0, below),
  };
  const fixed = table[`${panelId}:${anchorId}`];
  if (fixed) return fixed;
  if ((panelId === "sleeve-left" || panelId === "sleeve-right") && anchorId === "sleeve-centre") return sleeveCentre(frame, panelId);
  return null;
}

/** The middle of a sleeve. The wearer's left sleeve is on the right of the page in the front view. */
function sleeveCentre(frame: Frame, panelId: string): Point {
  const { basis } = frame;
  const { lowerEnd } = sleeveEnds(basis);
  const top = pt(basis.top.x + basis.along.x * basis.sleeveLength * 0.5, basis.top.y + basis.along.y * basis.sleeveLength * 0.5);
  const under = pt((basis.underarm.x + lowerEnd.x) / 2, (basis.underarm.y + lowerEnd.y) / 2);
  const x = (top.x + under.x) / 2;
  const onRight = (panelId === "sleeve-left") === (frame.view === "front");
  return pt(onRight ? x : -x, (top.y + under.y) / 2);
}
