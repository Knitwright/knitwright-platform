import { LANDMARK_IDS, type GradedPattern, type PatternPiece, type Point } from "@/lib/production/contract";

/**
 * Writes pieces as an AAMA/ASTM-style DXF in millimetres: the cut line on layer 1, turn points
 * (landmarks) on 2, notches on 4, grain line on 7 and 5, fold line on 6, internal lines on 8
 * and the sew line on 14, with the piece's name, size, quantity, whether the cut line holds
 * seam allowance, and each seam's allowance as text. Numbers are written to 0.01 mm. The same
 * pieces always give the same bytes: there is no date, no random id and no unordered map.
 */

export const DRAFT_NOTICE = "Draft pattern, not reviewed.";

export type WriteOptions = Readonly<{
  styleName: string;
  /** The sentence the file carries about its review. */
  status?: string;
}>;

const fmt = (n: number): string => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);

class Writer {
  readonly lines: string[] = [];
  pair(code: number, value: string | number): void {
    this.lines.push(String(code), String(value));
  }
  section(name: string, body: () => void): void {
    this.pair(0, "SECTION");
    this.pair(2, name);
    body();
    this.pair(0, "ENDSEC");
  }
  text(layer: string, at: Point, rawValue: string): void {
    // A line break in a name would start a new line of the file, so it is made a space.
    const value = rawValue.replace(/[\r\n]+/g, " ");
    this.pair(0, "TEXT");
    this.pair(8, layer);
    this.pair(10, fmt(at[0]));
    this.pair(20, fmt(at[1]));
    this.pair(40, "0.00");
    this.pair(1, value);
    this.pair(7, "STANDARD");
  }
  point(layer: string, at: Point): void {
    this.pair(0, "POINT");
    this.pair(8, layer);
    this.pair(10, fmt(at[0]));
    this.pair(20, fmt(at[1]));
  }
  line(layer: string, from: Point, to: Point): void {
    this.pair(0, "LINE");
    this.pair(8, layer);
    this.pair(10, fmt(from[0]));
    this.pair(20, fmt(from[1]));
    this.pair(11, fmt(to[0]));
    this.pair(21, fmt(to[1]));
  }
  polyline(layer: string, points: readonly Point[], closed: boolean): void {
    this.pair(0, "POLYLINE");
    this.pair(8, layer);
    this.pair(66, 1);
    this.pair(70, closed ? 1 : 0);
    const run = closed ? [...points, points[0]] : points;
    for (const p of run) {
      this.pair(0, "VERTEX");
      this.pair(8, layer);
      this.pair(10, fmt(p[0]));
      this.pair(20, fmt(p[1]));
    }
    this.pair(0, "SEQEND");
    this.pair(8, layer);
  }
}

const ORIGIN: Point = [0, 0];

const halves = (piece: PatternPiece): string =>
  piece.mirroredPair ? `${piece.quantity / 2},${piece.quantity / 2}` : `${piece.quantity},0`;

function writeAnnotations(w: Writer, piece: PatternPiece): void {
  const notes = [
    `PIECE NAME: ${piece.name}`,
    `PIECE ID: ${piece.id}`,
    `SIZE: ${piece.sizeLabel}`,
    "ANNOTATION: CUT",
    `CATEGORY: ${piece.name}`,
    `QUANTITY: ${halves(piece)}`,
    `OUTLINE: ${piece.outlineKind}`,
    ...piece.seamAllowance.map((a) => `SEAM ALLOWANCE: ${a.seamId} ${a.mm === null ? "not-stated" : `${fmt(a.mm)} ${a.source}`}`),
  ];
  for (const note of notes) w.text("1", ORIGIN, note);
}

function writeGeometry(w: Writer, piece: PatternPiece): void {
  w.polyline("1", piece.cutOutline, true);
  if (piece.sewLine) w.polyline("14", piece.sewLine, true);
  for (const name of LANDMARK_IDS) {
    const at = piece.landmarks[name];
    if (!at) continue;
    w.point("2", at);
    w.text("2", at, `LANDMARK: ${name} ${fmt(at[0])} ${fmt(at[1])}`);
  }
  for (const notch of piece.notches) {
    w.point("4", notch.at);
    w.text("4", notch.at, `NOTCH: ${notch.seamId} ${notch.count}`);
  }
  if (piece.foldLine) w.line("6", piece.foldLine.from, piece.foldLine.to);
  if (piece.grainLine) {
    w.line("7", piece.grainLine.from, piece.grainLine.to);
    w.line("5", piece.grainLine.from, piece.grainLine.to);
  }
  for (const inner of piece.internalLines) w.polyline("8", inner, false);
}

const blockName = (piece: PatternPiece, taken: Set<string>): string => {
  let name = `${piece.name}_${piece.sizeLabel}`;
  for (let n = 2; taken.has(name); n += 1) name = `${piece.name}_${piece.sizeLabel}-${n}`;
  taken.add(name);
  return name;
};

const extent = (piece: PatternPiece): { min: Point; width: number; height: number } => {
  const xs = piece.cutOutline.map((p) => p[0]);
  const ys = piece.cutOutline.map((p) => p[1]);
  const min: Point = [Math.min(...xs), Math.min(...ys)];
  return { min, width: Math.max(...xs) - min[0], height: Math.max(...ys) - min[1] };
};

const GAP_MM = 50;

/** Where each block is placed on the sheet: a row per size, pieces side by side. */
function placements(pieces: readonly PatternPiece[], names: readonly string[]): { name: string; at: Point }[] {
  const sizes = [...new Set(pieces.map((p) => p.sizeLabel))];
  let rowY = 0;
  return sizes.flatMap((size) => {
    let x = 0;
    let rowHeight = 0;
    const row = pieces.flatMap((piece, i) => {
      if (piece.sizeLabel !== size) return [];
      const box = extent(piece);
      const at: Point = [x - box.min[0], rowY - box.min[1]];
      x += box.width + GAP_MM;
      rowHeight = Math.max(rowHeight, box.height);
      return [{ name: names[i], at }];
    });
    rowY += rowHeight + GAP_MM;
    return row;
  });
}

/** One DXF holding all the pieces given, of one size or of many. */
export function writeDxf(pieces: readonly PatternPiece[], options: WriteOptions): string {
  const w = new Writer();
  const taken = new Set<string>();
  const names = pieces.map((p) => blockName(p, taken));
  w.section("HEADER", () => {
    w.pair(9, "$ACADVER");
    w.pair(1, "AC1009");
    w.pair(9, "$INSUNITS");
    w.pair(70, 4);
    w.pair(9, "$MEASUREMENT");
    w.pair(70, 1);
  });
  w.section("BLOCKS", () => {
    pieces.forEach((piece, i) => {
      w.pair(0, "BLOCK");
      w.pair(8, "1");
      w.pair(2, names[i]);
      w.pair(70, 64);
      w.pair(10, "0.00");
      w.pair(20, "0.00");
      writeAnnotations(w, piece);
      writeGeometry(w, piece);
      w.pair(0, "ENDBLK");
      w.pair(8, "1");
    });
  });
  w.section("ENTITIES", () => {
    for (const { name, at } of placements(pieces, names)) {
      w.pair(0, "INSERT");
      w.pair(8, "1");
      w.pair(2, name);
      w.pair(10, fmt(at[0]));
      w.pair(20, fmt(at[1]));
      w.pair(41, "1.0000");
      w.pair(42, "1.0000");
      w.pair(43, "1.0000");
      w.pair(50, "0.0000");
    }
    const sizes = [...new Set(pieces.map((p) => p.sizeLabel))];
    for (const note of [`STYLE NAME: ${options.styleName}`, "AUTHOR: Knitwright", `SAMPLE SIZE: ${sizes[0] ?? ""}`, `SIZES: ${sizes.join(" ")}`, "UNITS: METRIC", `STATUS: ${options.status ?? DRAFT_NOTICE}`]) {
      w.text("1", ORIGIN, note);
    }
  });
  w.pair(0, "EOF");
  return `${w.lines.join("\n")}\n`;
}

/** One DXF per size, in the order the set lists its sizes. */
export function writeDxfPerSize(pattern: GradedPattern, options: WriteOptions): Record<string, string> {
  return Object.fromEntries(pattern.sizes.map((size) => [size, writeDxf(pattern.piecesBySize[size], options)]));
}

/** One DXF with every size in it. */
export function writeDxfAllSizes(pattern: GradedPattern, options: WriteOptions): string {
  return writeDxf(pattern.sizes.flatMap((size) => pattern.piecesBySize[size]), options);
}
