/**
 * The sampling plan an inspection is taken under (spec F-O3, rule R-QC-001; plan v5 O1, decision 0100).
 *
 * Every figure comes from a row of `ops_aql_sample_plans` and `ops_aql_acceptance`. Nothing here holds a lot
 * band, a sample size or an accept number of its own: with no rows, the answer is "not on file" and the screen
 * names what is missing. The seeded rows are all `sourced: false` (no copy of ISO 2859-1 could be reached),
 * so a plan built from them says so and never decides whether an order ships.
 */

export const DEFAULT_INSPECTION_LEVEL = "II";

export interface SamplePlanRow {
  readonly codeLetter: string;
  readonly inspectionLevel: string;
  readonly lotMin: number;
  /** Null: the largest band, with no upper bound. */
  readonly lotMax: number | null;
  readonly sampleSize: number;
  /** The published document the row was read out of. Null: nobody has cited one. */
  readonly source: string | null;
  readonly sourced: boolean;
  readonly ruleId: string;
  readonly label: string;
}

export type DefectClass = "critical" | "major" | "minor";

export interface AcceptanceRow {
  readonly codeLetter: string;
  readonly aql: number;
  readonly defectClass: DefectClass;
  /** Null together with `rejectAt` when the row is an arrow to another code letter. */
  readonly acceptAt: number | null;
  readonly rejectAt: number | null;
  readonly useCodeLetter: string | null;
  readonly source: string | null;
  readonly sourced: boolean;
  readonly ruleId: string;
  readonly label: string;
}

export interface AqlTable {
  readonly plans: readonly SamplePlanRow[];
  readonly acceptance: readonly AcceptanceRow[];
}

export const EMPTY_AQL_TABLE: AqlTable = { plans: [], acceptance: [] };

/** One AQL column of a resolved plan: how many defects of that class are accepted, and in what sample. */
export interface AqlLevel {
  readonly aql: number;
  readonly defectClass: DefectClass;
  readonly acceptAt: number;
  readonly rejectAt: number;
  /** The letter the numbers were read at: the lot's own letter, or the one its arrow points to. */
  readonly codeLetter: string;
  readonly sampleSize: number;
  readonly sourced: boolean;
  readonly ruleId: string;
  readonly label: string;
}

export type ResolvedPlan =
  | Readonly<{
      status: "on-file";
      codeLetter: string;
      sampleSize: number;
      inspectionLevel: string;
      levels: readonly AqlLevel[];
      /** True only when every row the plan was built from has been checked against its source. */
      sourced: boolean;
      ruleId: string;
      label: string;
    }>
  | Readonly<{ status: "not-on-file"; missing: readonly string[] }>;

/** "0", "2.5", "4.0": the AQL as the spec writes it. */
export const describeAql = (aql: number): string => (aql === 0 ? "0" : aql.toFixed(1));

export const DEFECT_CLASS_LABELS: Readonly<Record<DefectClass, string>> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};

const byLetter = (plans: readonly SamplePlanRow[]): Map<string, SamplePlanRow> => new Map(plans.map((p) => [p.codeLetter, p]));

/** The band a lot of `lotSize` pieces falls in, at the given level. Null when no row covers it. */
export function letterFor(table: AqlTable, lotSize: number, level: string = DEFAULT_INSPECTION_LEVEL): SamplePlanRow | null {
  return (
    table.plans.find(
      (p) => p.inspectionLevel === level && lotSize >= p.lotMin && (p.lotMax === null || lotSize <= p.lotMax),
    ) ?? null
  );
}

/** How many hops of the table's arrows are followed before giving up. An arrow to an arrow is already unusual. */
const MAX_ARROW_HOPS = 4;

/**
 * Follows the table's arrows ("use the first sampling plan at this letter") from `letter` until a row with
 * accept and reject numbers is found. Null when the chain runs out, loops, or names a letter with no plan.
 */
function resolveLevel(table: AqlTable, letter: string, aql: number): AqlLevel | null {
  const plans = byLetter(table.plans);
  const seen = new Set<string>();
  let at = letter;
  for (let hop = 0; hop <= MAX_ARROW_HOPS; hop += 1) {
    if (seen.has(at)) return null;
    seen.add(at);
    const row = table.acceptance.find((a) => a.codeLetter === at && a.aql === aql);
    const plan = plans.get(at);
    if (!row || !plan) return null;
    if (row.acceptAt !== null && row.rejectAt !== null) {
      return {
        aql: row.aql,
        defectClass: row.defectClass,
        acceptAt: row.acceptAt,
        rejectAt: row.rejectAt,
        codeLetter: at,
        sampleSize: plan.sampleSize,
        sourced: row.sourced && plan.sourced,
        ruleId: row.ruleId,
        label: row.label,
      };
    }
    if (row.useCodeLetter === null) return null;
    at = row.useCodeLetter;
  }
  return null;
}

/** The AQL columns the table holds, smallest first. Empty when the table is empty. */
export const aqlColumnsOf = (table: AqlTable): readonly number[] => [...new Set(table.acceptance.map((a) => a.aql))].sort((a, b) => a - b);

/** The plan for a lot of `lotSize` pieces: the code letter, the sample size and every AQL column on file. */
export function planFor(table: AqlTable, lotSize: number, level: string = DEFAULT_INSPECTION_LEVEL): ResolvedPlan {
  const plan = letterFor(table, lotSize, level);
  if (plan === null) {
    return {
      status: "not-on-file",
      missing: [`the sampling table for inspection level ${level} covering a lot of ${lotSize} pieces`],
    };
  }
  const levels = aqlColumnsOf(table)
    .map((aql) => resolveLevel(table, plan.codeLetter, aql))
    .filter((level_): level_ is AqlLevel => level_ !== null);
  if (levels.length === 0) {
    return { status: "not-on-file", missing: [`the accept and reject numbers at code letter ${plan.codeLetter}`] };
  }
  return {
    status: "on-file",
    codeLetter: plan.codeLetter,
    sampleSize: plan.sampleSize,
    inspectionLevel: plan.inspectionLevel,
    levels,
    sourced: plan.sourced && levels.every((l) => l.sourced),
    ruleId: plan.ruleId,
    label: plan.label,
  };
}

/** What a reader is told about a plan no source backs. Never softened: a figure like that decides nothing. */
export const UNSOURCED_PLAN_NOTE =
  "This sampling plan was typed from a republished copy of the table, and nobody has read it against ISO 2859-1 itself. It is shown as guidance and decides nothing: the inspector's own verdict and the measurements decide an inspection.";

/** "Code letter H, 50 pieces inspected out of 300." */
export function describePlan(plan: ResolvedPlan, lotSize: number): string {
  if (plan.status === "not-on-file") return `No sampling plan is on file for a lot of ${lotSize} pieces.`;
  return `Code letter ${plan.codeLetter}, ${plan.sampleSize} ${plan.sampleSize === 1 ? "piece" : "pieces"} inspected out of ${lotSize}.`;
}

/** "Accept at 3, reject at 4." */
export const describeLevel = (level: AqlLevel): string => `Accept at ${level.acceptAt}, reject at ${level.rejectAt}.`;
