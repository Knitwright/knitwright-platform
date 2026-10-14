import { formatCm } from "@/lib/garment";
import { TBC, type Cell, type LengthCell, type LengthValue } from "../cell";
import type { RepeatSpec } from "./input";
import type { RepeatBlock } from "./types";

const tenths = (mm: number): number => Math.round(mm * 10);

const length = (mm: number): LengthCell => ({ status: "set", value: formatCm(tenths(mm)), tenthsMm: tenths(mm), provenance: "user-edited" });

const word = (text: string): Cell => ({ status: "set", value: text, provenance: "user-edited" });

/** The distance between the centres of the closest two dots of the repeat, in millimetres. */
export function closestCentres(r: Pick<RepeatSpec, "pitchMm" | "rowStepMm" | "halfDrop">): number {
  // Along a row; to the next row; and, when every other row drops by half a pitch, to the row after.
  const nextRow = r.halfDrop ? Math.hypot(r.pitchMm / 2, r.rowStepMm) : r.rowStepMm;
  return Math.min(r.pitchMm, nextRow, ...(r.halfDrop ? [2 * r.rowStepMm] : []));
}

function problemsOf(r: RepeatSpec, gapMm: number): string[] {
  const found: string[] = [];
  if (r.diameterMm <= 0) found.push("A dot has no size.");
  if (r.pitchMm <= 0 || r.rowStepMm <= 0) found.push("The pitch and the row step must each be more than zero.");
  if (r.diameterMm > 0 && r.pitchMm > 0 && r.rowStepMm > 0 && gapMm <= 0) found.push("Dots touch or overlap: widen the pitch or the row step.");
  if (r.clearSpaceMm < 0) found.push("The clear space cannot be less than zero.");
  return found;
}

/**
 * The dot repeat as numbers a print file is built from, and a check on them: the closest two dots
 * must leave a gap. The check reads the numbers only. It does not draw anything.
 */
export function buildRepeat(r: RepeatSpec | null | undefined): RepeatBlock | null {
  if (!r) return null;
  const gapMm = closestCentres(r) - r.diameterMm;
  const problems = problemsOf(r, gapMm);
  const gap: LengthValue = Number.isFinite(gapMm) ? { status: "set", value: formatCm(tenths(gapMm)), tenthsMm: tenths(gapMm), provenance: "derived" } : TBC;
  const gapSentence = gap.status === "set" ? [`The closest two dots are ${gap.value} cm apart, edge to edge.`] : [];
  return {
    lengths: [
      { label: "Dot size across", measure: length(r.diameterMm) },
      { label: "Pitch, centre to centre along a row", measure: length(r.pitchMm) },
      { label: "Row step", measure: length(r.rowStepMm) },
      { label: "Clear space around marks", measure: length(r.clearSpaceMm) },
    ],
    settings: [
      { label: "Style", setting: word("Dots") },
      { label: "Every other row", setting: word(r.halfDrop ? "Dropped by half a pitch" : "In line") },
      { label: "Row A colour", setting: word(r.rowColours.A) },
      { label: "Row B colour", setting: word(r.rowColours.B) },
    ],
    checks: [...gapSentence, ...problems],
    gap,
    ok: problems.length === 0,
  };
}
