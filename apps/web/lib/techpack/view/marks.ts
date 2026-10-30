import { GAP_RULE } from "@/lib/kpp/model";
import type { ExtraPom } from "./measurements";

/**
 * The **Specs toolbar** (spec F-S4 left rail, spec F-S6 Measurements): Select, Measure point,
 * Measure line, Measure edge and Callout. A tool is pressed, then points are picked on the drawing,
 * and what is picked becomes a mark that the tech pack view reads.
 *
 * This file holds the whole of the toolbar's thinking and no drawing at all, so every rule below is
 * tested without a browser:
 *
 * - **A measure line's length is measured, not typed.** It is the length of the picked polyline in
 *   millimetres, to the nearest millimetre, in the same units the base article's points of measure
 *   are in. A mark with too few points has no length at all; it is never zero.
 * - **A mark is the founder's own QC point, never a graded one** (spec F-S6: founders add extra
 *   POMs "measured on the sample, not graded"). `extraPomsFrom` turns the measure marks into
 *   `ExtraPom`s, which carry a value only at the sample size and no grade and no tolerance
 *   (plan v5 decision 18).
 * - **Nothing a mark holds is a settled fact.** A mark carries `R-GAP-000` until a rulebook entry
 *   covers founder-drawn points, and it is listed on the pull request as a gap.
 */

export const SPEC_TOOLS = ["select", "measure-point", "measure-line", "measure-edge", "callout"] as const;
export type SpecTool = (typeof SPEC_TOOLS)[number];

export const TOOL_LABELS: Readonly<Record<SpecTool, string>> = {
  select: "Select",
  "measure-point": "Measure point",
  "measure-line": "Measure line",
  "measure-edge": "Measure edge",
  callout: "Callout",
};

/** What each tool does, in one line, for the button's title and for a screen reader. */
export const TOOL_HELP: Readonly<Record<SpecTool, string>> = {
  select: "Pick a mark that is already on the drawing.",
  "measure-point": "Mark one place on a panel and name it.",
  "measure-line": "Pick two or more places; the length between them goes on the Measurements tab.",
  "measure-edge": "Pick one edge of a piece; its whole length goes on the Measurements tab.",
  callout: "Mark a place and write a note; it goes on the Callouts tab with its own number.",
};

/** How many places each tool needs before it has a mark. An edge is picked once, as a whole. */
export const TOOL_POINTS: Readonly<Record<SpecTool, number>> = {
  select: 0,
  "measure-point": 1,
  "measure-line": 2,
  "measure-edge": 1,
  callout: 1,
};

/** True for the tools that draw. Select picks what is already drawn. */
export const isDrawingTool = (tool: SpecTool): boolean => TOOL_POINTS[tool] > 0;

/** One place picked on a panel, in millimetres from the panel's own origin. */
export type PickedPoint = Readonly<{ panelId: string; xMm: number; yMm: number }>;

/**
 * One mark. `lengthMm` is the length of the line, or the length of the picked edge, and is null for a
 * point and for a callout: neither has a length, and a zero would read as one.
 */
export type SpecMark = Readonly<{
  id: string;
  tool: SpecTool;
  /** What the person called it, or the panel's own name when they called it nothing. */
  label: string;
  note: string | null;
  points: readonly PickedPoint[];
  lengthMm: number | null;
  /** Which view it was drawn on, so the tech pack can say so. */
  drawnOn: "2d" | "3d";
}>;

const distance = (from: PickedPoint, to: PickedPoint): number => Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm);

/**
 * The length of a picked polyline in whole millimetres, or null when fewer than two places were
 * picked. Whole millimetres because that is the unit the base article's points of measure are in; a
 * tenth of a millimetre read off a drawing would be a precision the drawing does not have.
 */
export function polylineLengthMm(points: readonly PickedPoint[]): number | null {
  if (points.length < 2) return null;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (from === undefined || to === undefined) return null;
    total += distance(from, to);
  }
  return Math.round(total);
}

/** How many more places a tool still needs, and the words that ask for them. */
export type PendingPick = Readonly<{ tool: SpecTool; picked: number; needed: number; ready: boolean; prompt: string }>;

export function pendingPick(tool: SpecTool, picked: number): PendingPick {
  const needed = TOOL_POINTS[tool];
  const ready = needed > 0 && picked >= needed;
  return { tool, picked, needed, ready, prompt: promptFor(tool, picked, needed, ready) };
}

function promptFor(tool: SpecTool, picked: number, needed: number, ready: boolean): string {
  if (needed === 0) return TOOL_HELP[tool];
  if (ready) return tool === "measure-line" ? "Pick another place to carry the line on, or keep the mark." : "Keep the mark, or pick again.";
  const left = needed - picked;
  return left === 1 ? "Pick one place on a panel." : `Pick ${left} places on a panel.`;
}

export type MarkInit = Readonly<{
  id: string;
  tool: SpecTool;
  label: string;
  note?: string | null;
  points: readonly PickedPoint[];
  drawnOn: "2d" | "3d";
  /** The length of a picked edge, which the drawing knows and the points do not. */
  edgeLengthMm?: number | null;
}>;

/**
 * A mark from what was picked. A line's length is worked out from its points; an edge's is the one
 * the drawing gave; a point and a callout have none. A tool that has not been given enough points
 * makes no mark at all, so a half-drawn line can never reach the tech pack.
 */
export function makeMark(init: MarkInit): SpecMark | null {
  if (!isDrawingTool(init.tool) || init.points.length < TOOL_POINTS[init.tool]) return null;
  const label = init.label.trim() === "" ? (init.points[0]?.panelId ?? init.tool) : init.label.trim();
  const note = init.note === undefined || init.note === null || init.note.trim() === "" ? null : init.note.trim();
  return { id: init.id, tool: init.tool, label, note, points: init.points, lengthMm: lengthFor(init), drawnOn: init.drawnOn };
}

function lengthFor(init: MarkInit): number | null {
  if (init.tool === "measure-line") return polylineLengthMm(init.points);
  if (init.tool === "measure-edge") return init.edgeLengthMm === undefined || init.edgeLengthMm === null ? null : Math.round(init.edgeLengthMm);
  return null;
}

/** The tools whose marks become points of measure. A callout is a note, not a measurement. */
const MEASURING: readonly SpecTool[] = ["measure-point", "measure-line", "measure-edge"];

export const isMeasureMark = (mark: SpecMark): boolean => MEASURING.includes(mark.tool);

/**
 * The measure marks as extra points of measure for the Measurements tab. Each is the founder's own
 * QC point: one value, at the sample size, with no grade and no tolerance. A measure point has no
 * length, so it carries none, and its row reads "Needs your input" until someone measures it.
 */
export function extraPomsFrom(marks: readonly SpecMark[], letterFor: (index: number) => string): readonly ExtraPom[] {
  return marks.filter(isMeasureMark).map((mark, index) => ({
    letter: letterFor(index),
    description: mark.note === null ? mark.label : `${mark.label} — ${mark.note}`,
    sampleMm: mark.lengthMm,
    ruleId: GAP_RULE,
  }));
}
