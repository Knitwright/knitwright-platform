import type { EditorDraft } from "@/lib/editor/slots";
import { patternSheet, type PatternSheet } from "./sheet";
import { sheetRules, type SheetRules } from "./sheet-rules";

/**
 * What the 2D view shows for the design the shell handed over (plan v5 Y3, decision 0076). The
 * drafter's three answers are kept apart and each is said in its own words: a drafted size becomes
 * a sheet, an article the platform cannot draft yet says why, and a form the article does not offer
 * lists the drafter's findings. Nothing is drawn from a guess.
 */
export type SheetView =
  | { readonly kind: "sheet"; readonly sheet: PatternSheet }
  | { readonly kind: "nothing"; readonly reason: string; readonly ruleId: string | null }
  | { readonly kind: "invalid"; readonly reasons: readonly string[] };

const NO_ARTICLE = "This design is not on a base article the platform can draft yet, so there are no pattern pieces to draw.";
const NO_PIECES = "The drafter made no pieces for this size, so there is nothing to draw.";

/** The hint the spec puts on the canvas (F-S4, "Applying things"). */
export const CANVAS_HINT = "Click to apply to all or drag to apply to one panel";

/** The sheet for the shown size, or the reason there is none. */
export function sheetFor(draft: EditorDraft | null, rules: SheetRules = sheetRules()): SheetView {
  if (draft === null) return { kind: "nothing", reason: NO_ARTICLE, ruleId: null };
  if (draft.kind === "not-drafted-yet") return { kind: "nothing", reason: draft.reason, ruleId: draft.ruleId };
  if (draft.kind === "invalid") return { kind: "invalid", reasons: draft.findings.map((finding) => finding.message) };
  if (draft.pieces.length === 0) return { kind: "nothing", reason: NO_PIECES, ruleId: null };
  return { kind: "sheet", sheet: patternSheet(draft.pieces, rules) };
}

/** The rule ids the sheet draws, so a test can prove every line on the canvas explains itself. */
export const ruleIdsOf = (sheet: PatternSheet): readonly string[] => [
  ...new Set([...sheet.pieces.flatMap((piece) => piece.rings.map((ring) => ring.ruleId)), sheet.grid.ruleId, sheet.scaleBar.ruleId]),
];
