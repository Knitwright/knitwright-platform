import { writeDxf, writeDxfAllSizes } from "@/lib/pattern-library/dxf/write";
import type { GradedPattern, PatternPiece, Point } from "@/lib/production/contract";
import { Canvas } from "../pdf/canvas";
import { PAGE_SIZES } from "../pdf/flow";
import { num, writePdf, type PdfPage } from "../pdf/writer";
import { layoutSheet, notchMark, pieceLabel, SHEET_MARGIN_MM, type PlacedPiece, type Sheet } from "./pattern-layout";

/**
 * The pattern files of one size: DXF-AAMA (the pattern library's writer), a 1:1 PDF tiled for A0
 * with alignment marks and a 100 mm scale bar on every tile, and a single-canvas SVG in mm.
 */

export interface PatternFileOptions {
  readonly article: string;
  readonly styleName: string;
  readonly notch: "v-notch" | "slit";
  /** The review sentence the DXF carries. */
  readonly status: string;
  readonly createdIso: string;
}

export const SCALE_BAR_MM = 100;
/** A0 portrait with a 10 mm unprinted margin on every side. */
const TILE_MARGIN_MM = 10;
const [A0_W, A0_H] = PAGE_SIZES.A0;
const TILE_W = A0_W - 2 * TILE_MARGIN_MM;
const TILE_H = A0_H - 2 * TILE_MARGIN_MM;

export const dxfForSize = (pieces: readonly PatternPiece[], o: PatternFileOptions): string => writeDxf(pieces, { styleName: o.styleName, status: o.status });

export const nestDxf = (pattern: GradedPattern, o: PatternFileOptions): string => writeDxfAllSizes(pattern, { styleName: o.styleName, status: o.status });

function drawPiece(c: Canvas, p: PlacedPiece): void {
  c.path(p.cut, true, { widthPt: 0.6 });
  if (p.sew) c.path(p.sew, true, { widthPt: 0.3, dash: [3, 2] });
  for (const run of p.internal) c.path(run, false, { widthPt: 0.3 });
  if (p.fold) c.line(p.fold.from, p.fold.to, { widthPt: 0.4, dash: [6, 2, 1, 2] });
  if (p.grain) {
    c.line(p.grain.from, p.grain.to, { widthPt: 0.5 });
    c.path(arrowHead(p.grain.to, p.grain.from), false, { widthPt: 0.5 });
    c.path(arrowHead(p.grain.from, p.grain.to), false, { widthPt: 0.5 });
  }
  for (const n of p.notches) c.line(n.at, notchMark(n.at, n.toward), { widthPt: 0.6 });
  pieceLabel(p).forEach((line, i) => c.text(p.centre[0], p.centre[1] + i * 9, line, { size: 20, align: "center" }));
}

/** Two short strokes at `tip`, pointing away from `tail`. */
function arrowHead(tip: Point, tail: Point): Point[] {
  const dx = tip[0] - tail[0];
  const dy = tip[1] - tail[1];
  const d = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / d, dy / d];
  const back = (side: number): Point => [tip[0] - ux * 8 + -uy * 4 * side, tip[1] - uy * 8 + ux * 4 * side];
  return [back(1), tip, back(-1)];
}

function scaleBar(c: Canvas, x: number, y: number): void {
  c.line([x, y], [x + SCALE_BAR_MM, y], { widthPt: 0.8 });
  for (let k = 0; k <= SCALE_BAR_MM; k += 10) c.line([x + k, y], [x + k, y - (k % 50 === 0 ? 3 : 1.5)], { widthPt: 0.4 });
  c.text(x + SCALE_BAR_MM + 3, y, `${SCALE_BAR_MM} mm: measure this bar to check the print is 1:1`, { size: 7 });
}

/** A cross at a tile corner, so neighbouring tiles line up when taped together. */
function alignmentMark(c: Canvas, x: number, y: number): void {
  c.line([x - 6, y], [x + 6, y], { widthPt: 0.3 });
  c.line([x, y - 6], [x, y + 6], { widthPt: 0.3 });
}

function tile(sheet: Sheet, o: PatternFileOptions, row: number, col: number, rows: number, cols: number): PdfPage {
  const c = new Canvas(A0_W, A0_H);
  c.clip(TILE_MARGIN_MM, TILE_MARGIN_MM, TILE_W, TILE_H, () =>
    c.offset(TILE_MARGIN_MM - col * TILE_W, TILE_MARGIN_MM - row * TILE_H, () => {
      if (row === 0 && col === 0) c.text(SHEET_MARGIN_MM, SHEET_MARGIN_MM, `${o.styleName} ${o.article} size ${sheet.pieces[0]?.size ?? ""}: 1:1, millimetres, ${o.notch === "slit" ? "slit" : "V"} notches`, { size: 14, bold: true });
      sheet.pieces.forEach((p) => drawPiece(c, p));
    }),
  );
  for (const [x, y] of [[TILE_MARGIN_MM, TILE_MARGIN_MM], [A0_W - TILE_MARGIN_MM, TILE_MARGIN_MM], [TILE_MARGIN_MM, A0_H - TILE_MARGIN_MM], [A0_W - TILE_MARGIN_MM, A0_H - TILE_MARGIN_MM]] as const) {
    alignmentMark(c, x, y);
  }
  c.text(TILE_MARGIN_MM + 8, TILE_MARGIN_MM - 3, `Tile row ${row + 1} column ${col + 1} of ${rows} x ${cols}. Join at the crosses. Print at 100%, no scaling.`, { size: 7 });
  scaleBar(c, A0_W - TILE_MARGIN_MM - SCALE_BAR_MM - 140, A0_H - 3);
  return c.page();
}

/** The 1:1 PDF of one size, tiled onto as many A0 pages as the sheet needs. */
export function pdf1to1(pieces: readonly PatternPiece[], o: PatternFileOptions): Uint8Array {
  const sheet = layoutSheet(pieces);
  const rows = Math.max(1, Math.ceil(sheet.heightMm / TILE_H));
  const cols = Math.max(1, Math.ceil(sheet.widthMm / TILE_W));
  const pages: PdfPage[] = [];
  for (let r = 0; r < rows; r += 1) for (let k = 0; k < cols; k += 1) pages.push(tile(sheet, o, r, k, rows, cols));
  return writePdf({ title: `${o.styleName} ${o.article} 1:1 pattern`, createdIso: o.createdIso, pages });
}

const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pts = (points: readonly Point[]): string => points.map((p) => `${num(p[0])},${num(p[1])}`).join(" ");

function svgPiece(p: PlacedPiece): string[] {
  const out = [`<polygon class="cut" points="${pts(p.cut)}"/>`];
  if (p.sew) out.push(`<polygon class="sew" points="${pts(p.sew)}"/>`);
  for (const run of p.internal) out.push(`<polyline class="internal" points="${pts(run)}"/>`);
  if (p.fold) out.push(`<line class="fold" x1="${num(p.fold.from[0])}" y1="${num(p.fold.from[1])}" x2="${num(p.fold.to[0])}" y2="${num(p.fold.to[1])}"/>`);
  if (p.grain) out.push(`<line class="grain" x1="${num(p.grain.from[0])}" y1="${num(p.grain.from[1])}" x2="${num(p.grain.to[0])}" y2="${num(p.grain.to[1])}"/>`);
  for (const n of p.notches) {
    const m = notchMark(n.at, n.toward);
    out.push(`<line class="notch" x1="${num(n.at[0])}" y1="${num(n.at[1])}" x2="${num(m[0])}" y2="${num(m[1])}"/>`);
  }
  pieceLabel(p).forEach((line, i) => out.push(`<text x="${num(p.centre[0])}" y="${num(p.centre[1] + i * 9)}">${esc(line)}</text>`));
  return out;
}

/** One size as a single SVG canvas in millimetres, the cut, sew, grain and notch lines in their own classes. */
export function patternSvg(pieces: readonly PatternPiece[], o: PatternFileOptions): string {
  const sheet = layoutSheet(pieces);
  const w = num(sheet.widthMm);
  const h = num(sheet.heightMm);
  const y = SHEET_MARGIN_MM + 18;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`,
    `<title>${esc(`${o.styleName} ${o.article} size ${sheet.pieces[0]?.size ?? ""}, 1:1, mm`)}</title>`,
    "<style>.cut{fill:none;stroke:#000;stroke-width:0.5}.sew{fill:none;stroke:#000;stroke-width:0.25;stroke-dasharray:3 2}.internal{fill:none;stroke:#000;stroke-width:0.25}.fold{stroke:#000;stroke-width:0.3;stroke-dasharray:6 2 1 2}.grain{stroke:#000;stroke-width:0.4}.notch{stroke:#000;stroke-width:0.5}text{font-family:Helvetica,Arial,sans-serif;font-size:7px;text-anchor:middle}</style>",
    `<g id="scale-bar"><line class="grain" x1="${SHEET_MARGIN_MM}" y1="${y}" x2="${SHEET_MARGIN_MM + SCALE_BAR_MM}" y2="${y}"/><text x="${SHEET_MARGIN_MM + SCALE_BAR_MM / 2}" y="${y - 3}">${SCALE_BAR_MM} mm</text></g>`,
    ...sheet.pieces.map((p, i) => `<g id="piece-${i + 1}">${svgPiece(p).join("")}</g>`),
    "</svg>",
    "",
  ].join("\n");
}
