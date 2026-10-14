import type { Shape } from "../geometry/boolean";
import { round2, type Box, type Pt } from "../geometry/vec";

/** Number as it is written in a file: at most 2 decimals, the same on any machine. */
export const num = (value: number): string => {
  const r = round2(value);
  return Object.is(r, -0) ? "0" : String(r);
};

export type PageMap = (p: Pt) => Pt;

/** Piece millimetres (y up) to the page's (y down), with the page's top-left corner at the origin. */
export const pageMap = (page: Box): PageMap => (p) => [p[0] - page.minX, page.maxY - p[1]];

export function pathData(shape: Shape, to: PageMap): string {
  return shape.map((ring) => `M${ring.map((p) => to(p)).map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}Z`).join("");
}
