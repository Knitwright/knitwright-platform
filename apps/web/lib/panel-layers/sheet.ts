import type { PatternPiece, Point } from "@/lib/production/contract";
import { offsetOutline } from "@/lib/production/geometry/offset";
import { sheetRules, type SheetRule, type SheetRules } from "./sheet-rules";

/**
 * The 2D pattern view of spec F-S4, as plain data in millimetres (plan v5 Y3, decision 0076): a
 * dotted grid, rulers, each piece with its cut line, sew line, bleed and safe zone, and a 100 mm
 * scale bar. Pure: the same pieces and rules give the same sheet, so the drawing is tested without
 * a browser and the canvas file holds no maths.
 *
 * Every line carries the rulebook entry that explains it. A line the pattern does not state is not
 * drawn and is reported as a note, never guessed: a piece with no sew line on file says so.
 */

export const RING_KINDS = ["bleed", "cut", "sew", "safe"] as const;
export type RingKind = (typeof RING_KINDS)[number];

/** One closed line on a piece, in the piece's own millimetres, drawn in this order (outermost first). */
export interface SheetRing {
  readonly kind: RingKind;
  readonly points: readonly Point[];
  readonly label: string;
  readonly ruleId: string;
}

export interface SheetPiece {
  readonly id: string;
  readonly name: string;
  readonly sizeLabel: string;
  readonly rings: readonly SheetRing[];
  readonly grainLine: PatternPiece["grainLine"];
  readonly foldLine: PatternPiece["foldLine"];
  readonly notches: readonly Point[];
  /** What this piece does not state, in plain words. Empty when it states everything the view draws. */
  readonly notes: readonly string[];
}

export interface BoundsMm {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** One mark on a ruler. A major mark carries its distance as a label; a minor one is a line only. */
export interface RulerTick {
  readonly mm: number;
  readonly major: boolean;
  readonly label: string | null;
}

export interface PatternSheet {
  readonly boundsMm: BoundsMm;
  readonly pieces: readonly SheetPiece[];
  readonly grid: SheetRule;
  readonly scaleBar: SheetRule;
  readonly rulerX: readonly RulerTick[];
  readonly rulerY: readonly RulerTick[];
  readonly rules: SheetRules;
  /** Said once above the canvas: what the whole sheet leaves out. */
  readonly notes: readonly string[];
}

const NO_SEW_LINE = "has no sew line on file, so the safe zone is measured from the cut line instead";
const EMPTY_BOUNDS: BoundsMm = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

const RING_LABELS: Readonly<Record<RingKind, string>> = {
  bleed: "Bleed",
  cut: "Cut line",
  sew: "Sew line",
  safe: "Safe zone",
};

/** Rounds to 0.01 mm, the precision the pattern files are written at. */
const round = (value: number): number => Math.round(value * 100) / 100;

/** The box that holds some points, or the empty box for none. */
export function boundsOf(points: readonly Point[]): BoundsMm {
  if (points.length === 0) return EMPTY_BOUNDS;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: round(Math.min(...xs)), minY: round(Math.min(...ys)), maxX: round(Math.max(...xs)), maxY: round(Math.max(...ys)) };
}

/**
 * The rings of one piece: the bleed outside the cut line, the cut line, the sew line when the
 * pattern states one, and the safe zone inside it. An offset that collapses (a piece smaller than
 * the distance asked for) is left out rather than drawn as a line of no area.
 */
function ringsOf(piece: PatternPiece, rules: SheetRules): { rings: readonly SheetRing[]; notes: readonly string[] } {
  const ring = (kind: RingKind, points: readonly Point[], ruleId: string): readonly SheetRing[] =>
    points.length < 3 ? [] : [{ kind, points, label: `${RING_LABELS[kind]} of ${piece.name}`, ruleId }];
  const inner = piece.sewLine ?? piece.cutOutline;
  return {
    rings: [
      ...ring("bleed", offsetOutline(piece.cutOutline, rules.bleed.mm), rules.bleed.ruleId),
      ...ring("cut", piece.cutOutline, rules.bleed.ruleId),
      ...(piece.sewLine === null ? [] : ring("sew", piece.sewLine, rules.safeZone.ruleId)),
      ...ring("safe", offsetOutline(inner, -rules.safeZone.mm), rules.safeZone.ruleId),
    ],
    notes: piece.sewLine === null ? [`${piece.name} ${NO_SEW_LINE}.`] : [],
  };
}

/** The ruler marks across a span, at the grid spacing, with a label every scale-bar length. */
export function rulerTicks(from: number, to: number, stepMm: number, labelEveryMm: number): readonly RulerTick[] {
  if (stepMm <= 0 || labelEveryMm <= 0 || !(to > from)) return [];
  const first = Math.ceil(from / stepMm) * stepMm;
  const ticks: RulerTick[] = [];
  for (let mm = first; mm <= to; mm += stepMm) {
    const at = round(mm);
    const major = Math.abs(at % labelEveryMm) < 1e-6;
    ticks.push({ mm: at, major, label: major ? `${at} mm` : null });
  }
  return ticks;
}

/** The whole sheet: every piece's rings, the grid, the rulers and the scale bar. */
export function patternSheet(pieces: readonly PatternPiece[], rules: SheetRules = sheetRules()): PatternSheet {
  const drawn = pieces.map((piece) => {
    const { rings, notes } = ringsOf(piece, rules);
    return {
      id: piece.id,
      name: piece.name,
      sizeLabel: piece.sizeLabel,
      rings,
      grainLine: piece.grainLine,
      foldLine: piece.foldLine,
      notches: piece.notches.map((notch) => notch.at),
      notes,
    } satisfies SheetPiece;
  });
  const all = drawn.flatMap((piece) => piece.rings.flatMap((entry) => [...entry.points]));
  const bounds = padded(boundsOf(all), rules.grid.mm);
  return {
    boundsMm: bounds,
    pieces: drawn,
    grid: rules.grid,
    scaleBar: rules.scaleBar,
    rulerX: rulerTicks(bounds.minX, bounds.maxX, rules.grid.mm, rules.scaleBar.mm),
    rulerY: rulerTicks(bounds.minY, bounds.maxY, rules.grid.mm, rules.scaleBar.mm),
    rules,
    notes: drawn.flatMap((piece) => piece.notes),
  };
}

/** The box with a margin of one grid square on every side, so the outermost line is not on the edge. */
function padded(bounds: BoundsMm, marginMm: number): BoundsMm {
  if (bounds.maxX === bounds.minX && bounds.maxY === bounds.minY) return bounds;
  return { minX: bounds.minX - marginMm, minY: bounds.minY - marginMm, maxX: bounds.maxX + marginMm, maxY: bounds.maxY + marginMm };
}
