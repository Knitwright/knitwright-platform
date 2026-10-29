import { SEEDED_DRAFT_CONSTANTS, ruleOf, type DraftConstantsSource } from "./constants";
import type { SeamLength } from "./types";

/**
 * The master-pattern contract of plan v5 owner decision 10. Spec F-S3 checks the drafter's
 * size-M default output against the factory's master pattern within 2 mm at article creation, and
 * no master pattern exists in the repository. So this file writes the contract down and reports
 * "no master pattern on file", which blocks `live`: the drafter is authoritative for what the
 * platform produces, and the factory's master is authoritative for whether an article may be sold.
 * Wave 3 (Z8) implements the gate itself; nothing here compares geometry.
 */

/** Who signed the master off, as the rulebook's sign-off column asks (owner decision 14). */
export type MasterPatternSignOff = Readonly<{ name: string; role: string; on: string }>;

/**
 * A factory's signed master pattern, stored as a reference artifact on the base article. `seams`
 * are measured off the master and labelled as the drafter labels its own (`SeamLength`), so the
 * two can be compared without either side knowing how the other was made.
 */
export type MasterPattern = Readonly<{
  articleCode: string;
  /** The size the master was cut in. F-S3 checks the default output for the article's base size. */
  size: string;
  artifactId: string;
  signedOff: MasterPatternSignOff;
  seams: readonly SeamLength[];
}>;

/** Where a signed master pattern is read from. No implementation holds one yet. */
export interface MasterPatternSource {
  get(articleCode: string): MasterPattern | null;
}

/** The state of the repository: no factory has returned a signed pattern (owner decision 10). */
export const NO_MASTER_PATTERNS: MasterPatternSource = { get: () => null };

/** A source over a fixed list, for Z8's tests and for the first factory pattern that arrives. */
export function masterPatternSource(masters: readonly MasterPattern[]): MasterPatternSource {
  const byCode = new Map(masters.map((m) => [m.articleCode, m]));
  return { get: (code) => byCode.get(code) ?? null };
}

/** One seam of the draft beside the same seam of the master. */
export type SeamDeviation = Readonly<{ label: string; masterMm: number; draftedMm: number; deviationMm: number; withinTolerance: boolean }>;

export const NO_MASTER_PATTERN_ON_FILE = "No master pattern on file";

/**
 * What the F-S3 check can say. Only the first two states are reachable today: no master pattern
 * exists, and a master that arrives has not been compared until Z8 implements the comparison.
 */
export type MasterPatternCheck =
  | Readonly<{ kind: "no-master-pattern-on-file"; articleCode: string; message: string; ruleId: string | null; toleranceMm: number }>
  | Readonly<{ kind: "not-checked-yet"; articleCode: string; master: MasterPattern; message: string; ruleId: string | null; toleranceMm: number }>
  | Readonly<{ kind: "checked"; articleCode: string; master: MasterPattern; deviations: readonly SeamDeviation[]; toleranceMm: number }>;

/**
 * The F-S3 check, as far as this workstream takes it: it reports the state of the master pattern
 * and never invents one. The tolerance is the article's own drafting constant, so the spec's 2 mm
 * is data like every other number.
 */
export function masterPatternCheck(
  articleCode: string,
  masters: MasterPatternSource = NO_MASTER_PATTERNS,
  constantsSource: DraftConstantsSource = SEEDED_DRAFT_CONSTANTS,
): MasterPatternCheck | null {
  const constants = constantsSource.get(articleCode);
  if (!constants) return null;
  const toleranceMm = constants.values.master_pattern.check.tolerance_mm;
  const ruleId = ruleOf(constants, "master_pattern.check");
  const master = masters.get(articleCode);
  if (!master) {
    return {
      kind: "no-master-pattern-on-file",
      articleCode,
      message: `${NO_MASTER_PATTERN_ON_FILE} for ${articleCode}. The article stays a draft until a factory returns a signed pattern.`,
      ruleId,
      toleranceMm,
    };
  }
  return {
    kind: "not-checked-yet",
    articleCode,
    master,
    message: `${articleCode} has a master pattern signed by ${master.signedOff.name}, ${master.signedOff.role}, on ${master.signedOff.on}, and it has not been checked against the draft yet.`,
    ruleId,
    toleranceMm,
  };
}

/**
 * Owner decision 10: an article cannot go `live` without a factory-checked master pattern. Every
 * other state of the check blocks it, including a master pattern nobody has compared yet.
 */
export function mayGoLive(check: MasterPatternCheck | null): boolean {
  return check?.kind === "checked" && check.deviations.length > 0 && check.deviations.every((d) => d.withinTolerance);
}
