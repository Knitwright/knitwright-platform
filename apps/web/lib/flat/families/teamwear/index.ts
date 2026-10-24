import type { GarmentSpec } from "@/lib/garment";
import type { Proportions } from "../../dimensions";
import { readBottomsOptions } from "../bottoms/options";
import { bottomsProportions } from "../bottoms/proportions";
import { drawBottoms } from "../bottoms";
import type { DrawContext, FamilyDrawing } from "../drawing";
import { capProportions, drawCap, readCapShape } from "./cap";
import { drawSock, readSockHeight, sockProportions } from "./sock";
import { drawTeamwearTop, isTeamwearTop, teamwearTopProportions } from "./top";

const BOTTOMS = new Set(["football-shorts", "cricket-trousers"]);
const SOCKS = "football-socks";
const CAP = "cricket-cap";

/**
 * Draws one side of a teamwear article. Shirts, training tops and tees go to the tops drawing
 * code, shorts and trousers to the bottoms code, and socks and the cap to their own drawing.
 * ADDING AN ARTICLE: draw it through one of these, then list it here and in the registry.
 */
export function drawTeamwear(context: DrawContext): FamilyDrawing | null {
  const id = context.spec.typeId;
  if (isTeamwearTop(id)) return drawTeamwearTop(context);
  if (BOTTOMS.has(id)) return drawBottoms(context);
  if (id === SOCKS) return drawSock(context);
  return id === CAP ? drawCap(context) : null;
}

/** The ratios an article is drawn with when it has no measurements. */
export function teamwearProportions(spec: GarmentSpec): Proportions {
  const id = spec.typeId;
  if (isTeamwearTop(id)) return teamwearTopProportions(spec);
  if (BOTTOMS.has(id)) return bottomsProportions(readBottomsOptions(spec));
  if (id === SOCKS) return sockProportions(readSockHeight(spec));
  if (id === CAP) return capProportions(readCapShape(spec));
  throw new Error(`No proportions for ${id}.`);
}
