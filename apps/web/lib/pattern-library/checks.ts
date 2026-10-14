import type { PatternPiece } from "@/lib/production/contract";
import { crossesItself, SELF_CROSSING_LIMIT, signedArea } from "./geometry";
import { missingLandmarks, pieceRole } from "./landmarks";
import { NOTCHED_SEAMS } from "./notches";
import { seamsOf, workLine, type Seam } from "./seams";

/**
 * The checks a pattern gets before it is stored. Each result is a plain sentence. A "refuse"
 * result stops the pattern being stored (the pieces would not sew together); a "warn" result
 * is shown with it; a "note" is information, such as the ease in a sleeve.
 */

export type CheckLevel = "refuse" | "warn" | "note";

export type CheckResult = Readonly<{
  id: string;
  size: string;
  ok: boolean;
  level: CheckLevel;
  sentence: string;
}>;

/** Joined seams that differ by more than this are refused. */
export const SEAM_TOLERANCE_MM = 2;

const mm = (value: number): string => `${value.toFixed(1)} mm`;
const name = (piece: PatternPiece): string => piece.name;

function outlineChecks(size: string, piece: PatternPiece): CheckResult[] {
  const line = workLine(piece);
  const closes = line.length >= 3 && Math.abs(signedArea(line)) > 1;
  const crossing = line.length <= SELF_CROSSING_LIMIT && crossesItself(line);
  const ok = closes && !crossing;
  return [{
    id: `outline-${piece.id}`, size, ok, level: "refuse",
    sentence: ok ? `${name(piece)}: the outline closes and does not cross itself.` : `${name(piece)}: the outline ${closes ? "crosses itself" : "does not close or has no area"}.`,
  }];
}

function pieceChecks(size: string, piece: PatternPiece): CheckResult[] {
  const missing = missingLandmarks(piece);
  const results: CheckResult[] = [
    {
      id: `grain-${piece.id}`, size, ok: piece.grainLine !== null, level: "warn",
      sentence: piece.grainLine ? `${name(piece)}: has a grain line.` : `${name(piece)}: has no grain line, so a cutter cannot tell which way to lay it.`,
    },
    {
      id: `landmarks-${piece.id}`, size, ok: missing.length === 0, level: "warn",
      sentence: missing.length === 0 ? `${name(piece)}: all its landmarks were found.` : `${name(piece)}: could not find ${missing.join(", ")}. Measurements that need them are left out until they are placed by hand.`,
    },
  ];
  const sleeveCutOnce = pieceRole(piece.id) === "sleeve" && piece.quantity < 2;
  const strange = piece.quantity > 10 || (piece.onFold && piece.quantity > 2) || sleeveCutOnce;
  results.push({
    id: `quantity-${piece.id}`, size, ok: !strange, level: "warn",
    sentence: strange ? `${name(piece)}: is to be cut ${piece.quantity} ${piece.quantity === 1 ? "time" : "times"}, which looks wrong for this piece.` : `${name(piece)}: the number to cut looks right (${piece.quantity}).`,
  });
  return results;
}

const find = (seams: ReadonlyMap<string, readonly Seam[]>, pieceId: string, seamId: string): Seam | undefined =>
  seams.get(pieceId)?.find((s) => s.seamId === seamId);

function joinCheck(size: string, id: string, label: string, a: Seam | undefined, b: Seam | undefined): CheckResult[] {
  if (!a || !b) return [{ id, size, ok: false, level: "warn", sentence: `${label}: could not be compared because a landmark is missing on the front or the back.` }];
  const gap = Math.abs(a.lengthMm - b.lengthMm);
  const ok = gap <= SEAM_TOLERANCE_MM;
  return [{
    id, size, ok, level: "refuse",
    sentence: ok
      ? `${label}: front ${mm(a.lengthMm)} and back ${mm(b.lengthMm)} agree (within ${SEAM_TOLERANCE_MM} mm).`
      : `${label}, size ${size}: the front is ${mm(a.lengthMm)} and the back is ${mm(b.lengthMm)}, ${mm(gap)} apart. They must agree within ${SEAM_TOLERANCE_MM} mm to sew together.`,
  }];
}

function easeCheck(size: string, pieces: readonly PatternPiece[], seams: ReadonlyMap<string, readonly Seam[]>): CheckResult[] {
  const sleeve = pieces.find((p) => pieceRole(p.id) === "sleeve");
  const armholes = [find(seams, "front", "armhole-front"), find(seams, "back", "armhole-back")];
  const caps = (sleeve ? seams.get(sleeve.id) ?? [] : []).filter((s) => s.seamId.startsWith("armhole") || s.seamId.startsWith("sleeve-cap"));
  if (!sleeve || armholes.some((a) => !a) || caps.length !== 2) return [];
  const armhole = armholes.reduce((sum, a) => sum + (a?.lengthMm ?? 0), 0);
  const cap = caps.reduce((sum, c) => sum + c.lengthMm, 0);
  const ease = cap - armhole;
  const sentence = Math.abs(ease) < 0.5
    ? `Sleeve cap ${mm(cap)} and armholes ${mm(armhole)}: no ease, the sleeve is sewn in as drawn.`
    : ease > 0 ? `Sleeve cap ${mm(cap)} is ${mm(ease)} longer than the armholes ${mm(armhole)}: that is the ease.` : `Sleeve cap ${mm(cap)} is ${mm(-ease)} shorter than the armholes ${mm(armhole)}: the sleeve would be stretched in.`;
  return [{ id: "ease", size, ok: true, level: "note", sentence }];
}

function allowanceCheck(size: string, pieces: readonly PatternPiece[]): CheckResult[] {
  const unknown = pieces.filter((p) => p.outlineKind === "unknown");
  return [{
    id: "seam-allowance", size, ok: unknown.length === 0, level: "warn",
    sentence: unknown.length === 0 ? "The file says whether its outlines hold seam allowance." : `${unknown.map(name).join(", ")}: the file does not say whether the outline holds seam allowance.`,
  }];
}

function notchCheck(size: string, pieces: readonly PatternPiece[], seams: ReadonlyMap<string, readonly Seam[]>): CheckResult[] {
  const missing = pieces.flatMap((piece) => {
    const wanted = [...new Set((seams.get(piece.id) ?? []).map((s) => s.seamId))].filter((id) => NOTCHED_SEAMS.has(id));
    const have = new Set(piece.notches.map((n) => n.seamId));
    return wanted.filter((id) => !have.has(id)).map((id) => `${name(piece)} (${id})`);
  });
  return [{
    id: "notches", size, ok: missing.length === 0, level: "warn",
    sentence: missing.length === 0 ? "Every joined seam has a notch." : `No notch on: ${missing.join(", ")}.`,
  }];
}

/** Every check on the pieces of one size. */
export function checkSize(size: string, pieces: readonly PatternPiece[]): CheckResult[] {
  const seams = seamsOf(pieces);
  return [
    ...pieces.flatMap((p) => [...outlineChecks(size, p), ...pieceChecks(size, p)]),
    ...joinCheck(size, "seam-side", "Side seams", find(seams, "front", "side-seam"), find(seams, "back", "side-seam")),
    ...joinCheck(size, "seam-shoulder", "Shoulder seams", find(seams, "front", "shoulder"), find(seams, "back", "shoulder")),
    ...easeCheck(size, pieces, seams),
    ...allowanceCheck(size, pieces),
    ...notchCheck(size, pieces, seams),
  ];
}

/** Results that stop a pattern being stored. */
export const refusals = (results: readonly CheckResult[]): CheckResult[] => results.filter((r) => !r.ok && r.level === "refuse");
