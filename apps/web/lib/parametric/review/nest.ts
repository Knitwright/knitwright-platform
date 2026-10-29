import { bbox } from "../geometry";
import type { ArticleDraft, DraftPiece } from "../types";
import { GAP, MARGIN } from "./layout";
import { pathD } from "./svg";
import { g15 } from "../format";

/** Line colour per size in the reference nest. A size not listed draws in black. */
const SIZE_COLOURS: Readonly<Record<string, string>> = {
  XS: "#7b3294",
  S: "#2c7bb6",
  M: "#000000",
  L: "#1a9641",
  XL: "#d7191c",
  "2XL": "#fdae61",
  "3XL": "#e66101",
};
export const sizeColour = (size: string): string => (Object.hasOwn(SIZE_COLOURS, size) ? SIZE_COLOURS[size] : "#000000");

export type NestColumn = Readonly<{
  label: string;
  x: number;
  ox: number;
  oy: number;
  bySize: readonly Readonly<{ size: string; piece: DraftPiece }>[];
}>;

export type NestLayout = Readonly<{
  code: string;
  version: string;
  baseSize: string;
  sizes: readonly string[];
  labelY: number;
  columns: readonly NestColumn[];
  width: number;
  height: number;
}>;

/**
 * All sizes stacked per piece on one origin (high shoulder point and centre line for the body,
 * cap top and centre for the sleeve), placed by the largest size, as the script's nest.
 */
export function nestLayout(drafts: readonly ArticleDraft[], baseSize: string): NestLayout {
  const big = drafts[drafts.length - 1];
  let x = MARGIN;
  let maxH = 0;
  const columns = big.pieces.map((bigPiece, i): NestColumn => {
    const bb = bbox(bigPiece.cutLine);
    const column = { label: bigPiece.label, x, ox: x - bb.x0, oy: MARGIN + 20 - bb.y0, bySize: drafts.map((d) => ({ size: d.size, piece: d.pieces[i] })) };
    maxH = Math.max(maxH, bb.y1 - bb.y0);
    x += bb.x1 - bb.x0 + GAP;
    return column;
  });
  return {
    code: big.articleCode,
    version: big.articleVersion,
    baseSize,
    sizes: drafts.map((d) => d.size),
    labelY: MARGIN + 10,
    columns,
    width: Math.ceil(x - GAP + MARGIN),
    height: Math.ceil(maxH + 2 * MARGIN + 60),
  };
}

/** The graded nest as one SVG at 1:1 in mm (`pattern/<code>_nest.svg`). */
export function nestSvg(nest: NestLayout): string {
  const body = nest.columns.map((col) => {
    const paths = col.bySize.map(({ size, piece }) => {
      const weight = size === nest.baseSize ? "0.6" : "0.3";
      return `<path d="${pathD(piece.cutLine, col.ox, col.oy)}" fill="none" stroke="${sizeColour(size)}" stroke-width="${weight}"/>`;
    });
    return `${paths.join("")}<text x="${g15(col.x)}" y="${nest.labelY}" font-family="Arial" font-size="10">${col.label}</text>`;
  });
  const legend = nest.sizes.map((s) => `<tspan fill="${sizeColour(s)}">${s}  </tspan>`).join("");
  const { width: W, height: H } = nest;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>` +
    body.join("") +
    `<text x="${MARGIN}" y="${H - 20}" font-family="Arial" font-size="9">${nest.code} v${nest.version} graded nest, cut lines, 1:1 mm. Sizes: ${legend} (base size ${nest.baseSize} in bold)</text></svg>`
  );
}
