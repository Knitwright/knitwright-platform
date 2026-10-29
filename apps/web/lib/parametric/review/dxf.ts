import { f2 } from "../format";
import type { Pt } from "../geometry";
import type { ArticleDraft } from "../types";
import type { NestLayout } from "./nest";
import { sheetLayout, type PlacedPiece } from "./layout";

/**
 * The factory review DXF of the reference script: R12 ASCII, mm, y flipped so the pattern reads
 * the right way up. Layers: 1 cut line, 14 sew line, 4 notches, 7 grain line, 15 text. This
 * article has no drill holes, so layer 13 is empty. Same draft, same bytes.
 */

export const DXF_LAYERS = { cut: "1", notch: "4", grain: "7", drill: "13", sew: "14", text: "15" } as const;

const HEADER = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
const FOOTER = "0\nENDSEC\n0\nEOF\n";

/** A closed polyline; the first point is not repeated (flag 70 = 1 closes it). */
export function polyline(layer: string, pts: readonly Pt[], ox: number, oy: number): string {
  const vertices = pts.map((p) => `0\nVERTEX\n8\n${layer}\n10\n${f2(p[0] + ox)}\n20\n${f2(-(p[1] + oy))}\n`).join("");
  return `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n1\n${vertices}0\nSEQEND\n8\n${layer}\n`;
}

const lineEntity = (layer: string, x1: string, y1: string, x2: string, y2: string): string =>
  `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`;

const textEntity = (x: number, y: number, value: string): string =>
  `0\nTEXT\n8\n${DXF_LAYERS.text}\n10\n${f2(x)}\n20\n${f2(-y)}\n40\n8\n1\n${value}\n`;

function pieceEntities({ piece, ox, oy, grain, label }: PlacedPiece): string {
  const notches = piece.notches.map(({ slit: [a, b] }) =>
    lineEntity(DXF_LAYERS.notch, f2(a[0] + ox), f2(-(a[1] + oy)), f2(b[0] + ox), f2(-(b[1] + oy))),
  );
  // The reference DXF draws the grain line at the label's x (the piece's middle); only its SVG
  // moves the rib's grain line 30 mm in. Kept so the files match byte for byte.
  const grainLine = lineEntity(DXF_LAYERS.grain, f2(label.x), f2(-grain.y0), f2(label.x), f2(-grain.y1));
  const texts = label.lines.map((t, i) => textEntity(label.x + 6, label.y + 12 * i, t));
  return [polyline(DXF_LAYERS.cut, piece.cutLine, ox, oy), polyline(DXF_LAYERS.sew, piece.sewLine, ox, oy), ...notches, grainLine, ...texts].join("");
}

/** One size: every piece side by side, as `pattern/<code>_<size>.dxf`. */
export function reviewDxf(draft: ArticleDraft): string {
  return HEADER + sheetLayout(draft).pieces.map(pieceEntities).join("") + FOOTER;
}

/**
 * The graded nest as DXF: per piece, every size's cut line stacked on the largest size's
 * placement (the same placement as the nest SVG), the piece and its sizes named on layer 15.
 */
export function nestDxf(nest: NestLayout): string {
  const body = nest.columns.map((col) => {
    const outlines = col.bySize.map(({ piece }) => polyline(DXF_LAYERS.cut, piece.cutLine, col.ox, col.oy)).join("");
    return outlines + textEntity(col.x, nest.labelY, `${col.label} ${col.bySize.map((s) => s.size).join(" ")}`);
  });
  return HEADER + body.join("") + FOOTER;
}
