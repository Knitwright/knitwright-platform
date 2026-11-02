import { listOf, RULE_AQL, warning, type ComplianceFinding } from "./model";
import type { AqlPlan, AqlScope } from "./rows";

/**
 * The AQL plan a package's QC checklist is written from (plan v5 Z8; decision 0070 section 6 left "the AQL
 * plan per factory" with no table, and `20261120070000_compliance.sql` adds it).
 *
 * Two things are kept apart here, because confusing them is how a placeholder becomes a promise:
 *
 * * **Which plan applies.** A factory's own row wins over the row that stands for every factory. Owner
 *   decision 19 stands above both: a Class A sample Knitwright makes is inspected piece by piece, whoever
 *   sews it, so that scope is asked for by name rather than being a run plan with a smaller number.
 * * **What the checklist may say.** A plan nobody has agreed is printed with its own label beside it and
 *   reported as a warning, never as a level a factory signed up to. A scope with no row at all says so in
 *   words. No figure is ever composed here: every number comes from the row, and a row that names a level
 *   with no source cannot exist (the table's own check refuses it).
 *
 * `qualityPlanLine` is the sentence `lib/kpp`'s QC checklist reads for its sampling line, which is the one
 * thing the production package asks this directory for.
 */

/** What the QC checklist says when no row covers the scope at all. */
export const NO_PLAN_SENTENCE =
  "No AQL plan is on file for this factory. Agree one before a run, and record it against the factory.";

/** Owner decision 19, for a Class A sample Knitwright makes itself. */
export const EVERY_PIECE_SENTENCE = "Inspect every piece: this is a Class A sample and the brand's approval rests on it.";

export interface PlanQuery {
  /** The factory the package is for. Null: no factory is chosen yet, so only an every-factory row applies. */
  readonly factoryId: string | null;
  readonly scope: AqlScope;
}

/**
 * The plan in force for one factory and scope: the factory's own row, else the row for every factory, else
 * nothing. Deterministic, and it never merges two rows: half of one plan and half of another is a plan
 * nobody wrote.
 */
export function planFor(plans: readonly AqlPlan[], query: PlanQuery): AqlPlan | null {
  const forScope = plans.filter((plan) => plan.scope === query.scope);
  const own = query.factoryId === null ? undefined : forScope.find((plan) => plan.factoryId === query.factoryId);
  return own ?? forScope.find((plan) => plan.factoryId === null) ?? null;
}

/**
 * The limits a row states, in the order the standard names them, leaving out any the row does not hold. Each
 * is printed to one decimal place, which is how the column stores it and how an AQL is written; nothing is
 * rounded, because the column holds one decimal place.
 */
const limitsOf = (plan: AqlPlan): readonly string[] =>
  [
    plan.criticalAql === null ? null : `${plan.criticalAql.toFixed(1)} critical`,
    plan.majorAql === null ? null : `${plan.majorAql.toFixed(1)} major`,
    plan.minorAql === null ? null : `${plan.minorAql.toFixed(1)} minor`,
  ].filter((limit): limit is string => limit !== null);

/**
 * One plan in words, quoted from its row. The label and the source are part of the sentence, not a footnote,
 * because this line is printed into `09_qc` and a factory reads it with nothing else beside it.
 */
export function planSentence(plan: AqlPlan): string {
  const parts: string[] = [];
  if (plan.inspectEveryPiece) parts.push("Inspect every piece");
  if (plan.inspectionLevel !== null) {
    const limits = limitsOf(plan);
    parts.push(
      limits.length === 0 ? `Inspection level ${plan.inspectionLevel}` : `Inspection level ${plan.inspectionLevel}, AQL ${listOf(limits)}`,
    );
  }
  const source = plan.source === null ? "" : ` Source: ${plan.source}.`;
  const caution = plan.confirmed ? "" : ` ${plan.label}`;
  return `${parts.join(". ")}.${source}${caution}`.trim();
}

/**
 * The sampling line of the QC checklist (`KppQc.aqlPlan`). Owner decision 19 first: a Class A sample
 * Knitwright makes is inspected piece by piece whatever any row says, so no row can quietly sample it.
 */
export function qualityPlanLine(
  plans: readonly AqlPlan[],
  query: PlanQuery,
  context: Readonly<{ classASampleMadeByKnitwright: boolean }>,
): string {
  if (context.classASampleMadeByKnitwright) return EVERY_PIECE_SENTENCE;
  const plan = planFor(plans, query);
  return plan === null ? NO_PLAN_SENTENCE : planSentence(plan);
}

/**
 * What the package and the Review tab carry beside the plan. A plan nobody has agreed is a warning, not a
 * blocker: refusing every run until a factory signs a level would stop the one thing that gets a level
 * agreed, and the sentence the factory reads already says the figure is a placeholder.
 */
export function planFindings(plans: readonly AqlPlan[], query: PlanQuery): readonly ComplianceFinding[] {
  const plan = planFor(plans, query);
  if (plan === null) {
    return [warning("aql_plan_missing", "quality.aqlPlan", NO_PLAN_SENTENCE, RULE_AQL)];
  }
  if (plan.confirmed) return [];
  return [
    warning(
      "aql_plan_unconfirmed",
      "quality.aqlPlan",
      `The inspection plan for this run is a placeholder nobody has agreed with the factory: ${plan.label}`,
      plan.ruleId,
    ),
  ];
}
