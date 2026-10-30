import { DEFAULT_SETTINGS, sourceNote, type GuardrailSettings } from "@/lib/guardrails";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";

/**
 * The numbers the 2D pattern view draws, and the rule that explains each one (plan v5 Y3,
 * decision 0076). Nothing here is a literal in the drawing code: every distance arrives as a
 * `SheetRule` with its value, its unit, the rulebook entry that states it and a plain note saying
 * who said it. A distance nobody has stated is not drawn.
 *
 * The bleed and the safe zone come from the guardrail settings the checks themselves use
 * (`lib/guardrails`, resolved from the platform settings), so the line a person sees on the canvas
 * is the line the checks measure against. Their rule ids are the sublimation rules of
 * `docs/spec/articles/JSY-SS-01/rulebook.md`.
 */
export interface SheetRule {
  readonly mm: number;
  readonly ruleId: string;
  /** Where the value came from, in words a person reads beside the drawing. */
  readonly note: string;
}

export interface SheetRules {
  /** How far the print runs past the cut line. R-SUB-002: 10 mm bleed beyond the cut line on every panel. */
  readonly bleed: SheetRule;
  /** How far critical artwork stays inside the sewn edge. R-SUB-004 states 15 mm away from seams. */
  readonly safeZone: SheetRule;
  /** The spacing of the dotted grid. A drawing aid, not a manufacturing measurement. */
  readonly grid: SheetRule;
  /** The length of the scale bar. A drawing aid: one bar of known length, so a printed screenshot can be checked. */
  readonly scaleBar: SheetRule;
}

/** The rule that states each distance. `R-GAP-000` where the rulebook has no entry for it yet. */
export const SHEET_RULE_IDS = {
  bleed: "R-SUB-002",
  safeZone: "R-SUB-004",
  grid: GAP_RULE_ID,
  scaleBar: GAP_RULE_ID,
} as const;

/** The grid's spacing in millimetres: a drawing aid, so it is Knitwright's own and labelled as such. */
export const GRID_MM = 10;
/** The scale bar of spec F-S4: "a 100 mm scale bar". */
export const SCALE_BAR_MM = 100;

const DRAWING_AID = "A Knitwright drawing aid, not a manufacturing measurement.";

/**
 * The distances the view draws, from the settings the checks use. The caller passes the resolved
 * platform settings; `DEFAULT_SETTINGS` is used where nothing has been resolved, and says so.
 */
export function sheetRules(settings: GuardrailSettings = DEFAULT_SETTINGS): SheetRules {
  return {
    bleed: { mm: settings.bleedMm.value, ruleId: SHEET_RULE_IDS.bleed, note: `Bleed ${settings.bleedMm.value} mm (${sourceNote(settings.bleedMm.source)}).` },
    safeZone: {
      mm: settings.safeZoneMm.value,
      ruleId: SHEET_RULE_IDS.safeZone,
      note: `Safe zone ${settings.safeZoneMm.value} mm (${sourceNote(settings.safeZoneMm.source)}).`,
    },
    grid: { mm: GRID_MM, ruleId: SHEET_RULE_IDS.grid, note: `Grid every ${GRID_MM} mm. ${DRAWING_AID}` },
    scaleBar: { mm: SCALE_BAR_MM, ruleId: SHEET_RULE_IDS.scaleBar, note: `${SCALE_BAR_MM} mm. ${DRAWING_AID}` },
  };
}
