import { f2 } from "../format";
import type { Pt } from "../geometry";
import type { ArticleDraft } from "../types";
import { MARGIN, sheetLayout, type PlacedPiece } from "./layout";

/**
 * The factory review SVG of the reference script: 1:1 in mm, solid cut line, dashed sew line, red
 * notches, blue grain line with arrows, the piece label and a 100 mm check bar. Same draft, same bytes.
 */

/** A closed SVG path through the points, moved by (ox, oy). */
export function pathD(pts: readonly Pt[], ox: number, oy: number): string {
  return `${pts.map((p, i) => `${i === 0 ? "M" : "L"}${f2(p[0] + ox)} ${f2(p[1] + oy)} `).join("")}Z`;
}

function pieceGroup({ piece, ox, oy, grain, label }: PlacedPiece): string {
  const parts = [
    `<g id="${piece.label.toLowerCase().replaceAll(" ", "_")}">`,
    `<path d="${pathD(piece.cutLine, ox, oy)}" fill="none" stroke="#000" stroke-width="0.6"/>`,
    `<path d="${pathD(piece.sewLine, ox, oy)}" fill="none" stroke="#777" stroke-width="0.3" stroke-dasharray="4 2"/>`,
    ...piece.notches.map(
      ({ slit: [a, b] }) =>
        `<line x1="${f2(a[0] + ox)}" y1="${f2(a[1] + oy)}" x2="${f2(b[0] + ox)}" y2="${f2(b[1] + oy)}" stroke="#d00" stroke-width="0.6"/>`,
    ),
    `<line x1="${f2(grain.x)}" y1="${f2(grain.y0)}" x2="${f2(grain.x)}" y2="${f2(grain.y1)}" stroke="#06c" stroke-width="0.5" marker-start="url(#a)" marker-end="url(#a)"/>`,
    ...label.lines.map(
      (t, i) => `<text x="${f2(label.x + 6)}" y="${f2(label.y + 12 * i)}" font-family="Arial" font-size="9" fill="#000">${t}</text>`,
    ),
    "</g>",
  ];
  return parts.join("");
}

/** One size: every piece side by side, as `pattern/<code>_<size>.svg`. */
export function reviewSvg(draft: ArticleDraft): string {
  const sheet = sheetLayout(draft);
  const W = sheet.width;
  const H = sheet.height;
  const note = `${draft.articleCode} v${draft.articleVersion} - size ${draft.size} - 1:1 scale, units mm - solid = cut line (seam allowance included), dashed = sew line, red = notches, blue = grain - DRAFT FOR FACTORY REVIEW`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n`,
    '<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#06c"/></marker></defs>\n',
    '<rect width="100%" height="100%" fill="#fff"/>\n',
    sheet.pieces.map(pieceGroup).join(""),
    `<text x="${MARGIN}" y="${H - 15}" font-family="Arial" font-size="8" fill="#444">${note}</text>`,
    `<g transform="translate(${MARGIN},${H - 45})"><line x1="0" y1="0" x2="100" y2="0" stroke="#000" stroke-width="0.6"/><line x1="0" y1="-4" x2="0" y2="4" stroke="#000"/><line x1="100" y1="-4" x2="100" y2="4" stroke="#000"/><text x="0" y="12" font-family="Arial" font-size="8">Check: this bar must measure 100 mm when printed</text></g>\n`,
    "</svg>\n",
  ].join("");
}
