import { GAP_RULE, type KppPrintRules, type KppQc } from "../model";
import { chosenFabric, type KppRows } from "./model";

/**
 * The QC checklist (`09_qc`) and the print thresholds the files are checked against.
 *
 * **Owner decision 19 stands: AQL as built.** A Class A sample that Knitwright makes inspects every piece, whoever
 * sews it, because it is the sample the brand's approval rests on. Any other package uses the AQL plan on the
 * input — the factory's own plan — and where no plan is on the input the checklist says so in words rather than
 * naming a level nobody agreed. `docs/spec/04`'s own "level II, AQL 0 critical / 2.5 major / 4.0 minor" is a plan a
 * factory signs up to, not a number the platform may assume on its behalf.
 *
 * The print thresholds are the guardrail settings in force (`lib/guardrails`, overridable by a print house in
 * `lib/settings`). The factory profile has no DPI or bleed column of its own yet, so what the factory is told is
 * what the platform produces, and the two cannot disagree.
 */

const EVERY_PIECE = "Inspect every piece: this is a Class A sample and the brand's approval rests on it.";
const NO_PLAN = "No AQL plan is on file for this factory. Agree one before a run; this package is not a run.";

/** The sampling line of the checklist, per owner decision 19. */
export function samplingPlan(rows: KppRows): string {
  if (rows.kind === "sample" && rows.article.productionClass === "A" && rows.madeByKnitwright) return EVERY_PIECE;
  return rows.unsourced.quality.aqlPlan ?? NO_PLAN;
}

const colourLine = (rows: KppRows): string => {
  const max = rows.capability?.colourDeltaMax ?? null;
  return max === null
    ? "Each colour role against the strike-off. No colour difference has been agreed with this factory, so record what was measured."
    : `Each colour role against the strike-off, delta E CMC 2:1 <= ${max}. Lab is sRGB under D65 with the two-degree observer; see 05_colour.`;
};

/** The QC checklist's content. The POMs to measure are the plan's; with none given, every POM the article has. */
export function qualityChecklist(rows: KppRows): KppQc {
  const plan = rows.unsourced.quality;
  return {
    aqlPlan: samplingPlan(rows),
    measure: plan.measure.length > 0 ? plan.measure : rows.article.poms.map((pom) => pom.letter),
    colour: colourLine(rows),
    visual: plan.visual,
    photos: plan.photos,
    ruleId: chosenFabric(rows)?.ruleId ?? GAP_RULE,
  };
}

/** What the print files are checked against, and what the README tells the factory they are. */
export const printRules = (rows: KppRows): KppPrintRules => ({
  minDpi: rows.print.minDpi.value,
  minBleedMm: rows.print.bleedMm.value,
  dpi: rows.print.minDpi.value,
  bleedMm: rows.print.bleedMm.value,
  ruleId: chosenFabric(rows)?.ruleId ?? GAP_RULE,
});
