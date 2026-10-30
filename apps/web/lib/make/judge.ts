import { blocker, GAP_RULE_ID, warning, type MakeFinding } from "./vocabulary";

/**
 * Judging the evidence on a golden sample: whether a measured point of measure is inside the tolerance it was
 * judged against, and whether a colour reading is inside the factory's own Delta-E limit.
 *
 * A point of measure with no tolerance on file is not inside anything: the gate keeps refusing a point of
 * measure that has no tolerance (owner decision 18), and the spec's defaults are placeholders. A reading with
 * no limit on file is shown as a reading and nothing more. Nothing here invents a tolerance or a limit.
 */

export interface MeasuredPom {
  readonly letter: string;
  readonly measuredMm: number;
  readonly targetMm: number | null;
  readonly tolMinusMm: number | null;
  readonly tolPlusMm: number | null;
  readonly ruleId: string;
}

export type PomVerdict =
  | Readonly<{ status: "inside"; offByMm: number; text: string }>
  | Readonly<{ status: "outside"; offByMm: number; finding: MakeFinding }>
  | Readonly<{ status: "cannot-judge"; finding: MakeFinding }>;

/** The millimetres the measurement is off its target, signed: positive is over. */
export const offBy = (pom: MeasuredPom): number | null => (pom.targetMm === null ? null : pom.measuredMm - pom.targetMm);

export function pomVerdict(pom: MeasuredPom): PomVerdict {
  const off = offBy(pom);
  if (off === null) {
    return { status: "cannot-judge", finding: warning("pom_no_target", `Point ${pom.letter} has no value on file for this size to judge it against.`, pom.ruleId) };
  }
  if (pom.tolMinusMm === null || pom.tolPlusMm === null) {
    return {
      status: "cannot-judge",
      finding: warning("pom_no_tolerance", `Point ${pom.letter} has no tolerance on file, so nothing says whether ${off} mm off is acceptable. That is a question for the factory.`, pom.ruleId),
    };
  }
  if (off > pom.tolPlusMm || off < -pom.tolMinusMm) {
    return {
      status: "outside",
      offByMm: off,
      finding: blocker("pom_outside_tolerance", `Point ${pom.letter} is ${off} mm off, outside the tolerance of minus ${pom.tolMinusMm} to plus ${pom.tolPlusMm} mm it was judged against.`, pom.ruleId),
    };
  }
  return { status: "inside", offByMm: off, text: `Point ${pom.letter} is ${off} mm off, inside minus ${pom.tolMinusMm} to plus ${pom.tolPlusMm} mm.` };
}

export type DeltaVerdict =
  | Readonly<{ status: "inside"; text: string }>
  | Readonly<{ status: "outside"; finding: MakeFinding }>
  | Readonly<{ status: "no-limit"; finding: MakeFinding }>;

/** `max` is the factory's own colour tolerance (factory_capabilities.colour_delta_max), or null when none is set. */
export function deltaVerdict(colourName: string, deltaE: number, max: number | null, ruleId: string = GAP_RULE_ID): DeltaVerdict {
  if (max === null) {
    return { status: "no-limit", finding: warning("delta_no_limit", `${colourName} reads Delta-E ${deltaE}. No colour tolerance is set for this factory, so nothing says whether that passes.`, ruleId) };
  }
  if (deltaE > max) {
    return { status: "outside", finding: blocker("delta_outside_limit", `${colourName} reads Delta-E ${deltaE}, over the ${max} this factory works to.`, ruleId) };
  }
  return { status: "inside", text: `${colourName} reads Delta-E ${deltaE}, within the ${max} this factory works to.` };
}

/** Every finding the evidence raises, for the panel's list. */
export const evidenceFindings = (verdicts: readonly (PomVerdict | DeltaVerdict)[]): readonly MakeFinding[] =>
  verdicts.flatMap((verdict) => ("finding" in verdict ? [verdict.finding] : []));
