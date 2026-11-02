import { z } from "zod";
import type { AcceptanceRow, SamplePlanRow } from "./plan";

/** The two AQL tables as the database holds them. A row that fails its schema is left out, never guessed at. */

export const SAMPLE_PLAN_COLUMNS = "code_letter, inspection_level, lot_min, lot_max, sample_size, source, verified, rule_id, label";
export const ACCEPTANCE_COLUMNS = "code_letter, aql, defect_class, accept_at, reject_at, use_code_letter, source, verified, rule_id, label";

const samplePlanRow = z.object({
  code_letter: z.string(),
  inspection_level: z.string(),
  lot_min: z.number().int(),
  lot_max: z.number().int().nullable(),
  sample_size: z.number().int(),
  source: z.string().nullable(),
  verified: z.boolean(),
  rule_id: z.string(),
  label: z.string(),
});

const acceptanceRow = z.object({
  code_letter: z.string(),
  aql: z.coerce.number(),
  defect_class: z.enum(["critical", "major", "minor"]),
  accept_at: z.number().int().nullable(),
  reject_at: z.number().int().nullable(),
  use_code_letter: z.string().nullable(),
  source: z.string().nullable(),
  verified: z.boolean(),
  rule_id: z.string(),
  label: z.string(),
});

export const toSamplePlan = (data: unknown): SamplePlanRow => {
  const r = samplePlanRow.parse(data);
  return {
    codeLetter: r.code_letter,
    inspectionLevel: r.inspection_level,
    lotMin: r.lot_min,
    lotMax: r.lot_max,
    sampleSize: r.sample_size,
    source: r.source,
    verified: r.verified,
    ruleId: r.rule_id,
    label: r.label,
  };
};

export const toAcceptance = (data: unknown): AcceptanceRow => {
  const r = acceptanceRow.parse(data);
  return {
    codeLetter: r.code_letter,
    aql: r.aql,
    defectClass: r.defect_class,
    acceptAt: r.accept_at,
    rejectAt: r.reject_at,
    useCodeLetter: r.use_code_letter,
    source: r.source,
    verified: r.verified,
    ruleId: r.rule_id,
    label: r.label,
  };
};

/** Rows the parser could read, in the order they came. One bad row never hides the rest. */
export function readable<T>(rows: readonly unknown[], read: (row: unknown) => T): readonly T[] {
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(read(row));
    } catch {
      // A row the schema refuses is not shown. The screen then says the plan is not on file.
    }
  }
  return out;
}
