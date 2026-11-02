import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_AQL_TABLE, type AqlTable } from "./plan";
import { ACCEPTANCE_COLUMNS, SAMPLE_PLAN_COLUMNS, readable, toAcceptance, toSamplePlan } from "./rows";

/**
 * The AQL table, read with the server's own key: no browser role reaches `ops_aql_sample_plans` or
 * `ops_aql_acceptance` at all (they are platform data, like the factory rows). A read that fails gives the
 * empty table, and the screen then says no sampling plan is on file rather than naming a sample size.
 */

type Reader = Pick<SupabaseClient, "from">;

const LIMIT = 500;

export async function loadAqlTable(admin: Reader): Promise<AqlTable> {
  try {
    const [plans, acceptance] = await Promise.all([
      admin.from("ops_aql_sample_plans").select(SAMPLE_PLAN_COLUMNS).order("lot_min").limit(LIMIT),
      admin.from("ops_aql_acceptance").select(ACCEPTANCE_COLUMNS).order("aql").order("code_letter").limit(LIMIT),
    ]);
    if (plans.error || acceptance.error) return EMPTY_AQL_TABLE;
    return {
      plans: readable(plans.data ?? [], toSamplePlan),
      acceptance: readable(acceptance.data ?? [], toAcceptance),
    };
  } catch {
    return EMPTY_AQL_TABLE;
  }
}
