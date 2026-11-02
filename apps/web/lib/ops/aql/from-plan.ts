import type { SupabaseClient } from "@supabase/supabase-js";
import { planFor as planForFactory } from "@/lib/compliance/aql";
import { AQL_PLAN_COLUMNS, toAqlPlan, type AqlPlan, type AqlScope } from "@/lib/compliance/rows";
import { planAtLevels, type AqlTable, type ResolvedPlan } from "./plan";

/**
 * Joining Z8's AQL plan to the standard's own sampling table (plan v5 O1, decision 0100; Z8's decision 0089).
 *
 * The two are different things and are kept apart on purpose:
 *
 * * **`aql_plans` (Z8) says which levels apply** to a factory and a scope: inspection level II, AQL 0
 *   critical / 2.5 major / 4.0 minor, with its own source, its `confirmed` flag and its label. That is the
 *   only place a level or a limit is decided, and a factory's own row wins over the row for every factory.
 * * **`ops_aql_sample_plans` / `ops_aql_acceptance` (here) say what the standard's table does with them**:
 *   how many pieces a lot of this size is inspected at, and at how many defects that sample is accepted or
 *   rejected.
 *
 * So the screen asks Z8 which plan is in force and then looks up **only the levels that plan names**. An AQL
 * column this table happens to hold but the plan does not name is not shown: that would be a level nobody
 * agreed to inspect against.
 */

export const RUN_SCOPE: AqlScope = "run";

/** The AQL limits a plan names, critical first, leaving out any the row does not hold. */
export const limitsOfPlan = (plan: AqlPlan): readonly number[] =>
  [plan.criticalAql, plan.majorAql, plan.minorAql].filter((limit): limit is number => limit !== null);

export type SamplingAnswer =
  | Readonly<{ status: "no-plan" }>
  | Readonly<{ status: "every-piece"; plan: AqlPlan }>
  | Readonly<{ status: "sampled"; plan: AqlPlan; sampling: ResolvedPlan }>;

/**
 * What an inspection of `lotSize` pieces is taken under. "No plan" when no row covers the factory and scope;
 * "every piece" when the plan in force says so (owner decision 19), in which case no sample size applies at
 * all; otherwise the plan plus the standard's own table for the levels it names.
 */
export function samplingFor(
  plans: readonly AqlPlan[],
  table: AqlTable,
  input: Readonly<{ factoryId: string | null; lotSize: number; scope?: AqlScope }>,
): SamplingAnswer {
  const plan = planForFactory(plans, { factoryId: input.factoryId, scope: input.scope ?? RUN_SCOPE });
  if (plan === null) return { status: "no-plan" };
  if (plan.inspectEveryPiece || plan.inspectionLevel === null) return { status: "every-piece", plan };
  return { status: "sampled", plan, sampling: planAtLevels(table, input.lotSize, plan.inspectionLevel, limitsOfPlan(plan)) };
}

/** Every AQL plan on file. Read with the person's own client: signed-in members may read the table (Z8). */
export async function loadAqlPlans(client: Pick<SupabaseClient, "from">): Promise<readonly AqlPlan[]> {
  try {
    const { data, error } = await client.from("aql_plans").select(AQL_PLAN_COLUMNS).limit(500);
    if (error) return [];
    const out: AqlPlan[] = [];
    for (const row of data ?? []) {
      try {
        out.push(toAqlPlan(row as Record<string, unknown>));
      } catch {
        // A row this reading cannot make sense of is left out; the screen then says no plan is on file.
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** The factory's own id, for asking Z8 which plan applies. Null when the slug names no factory on file. */
export async function factoryIdOf(admin: Pick<SupabaseClient, "from">, slug: string): Promise<string | null> {
  try {
    const { data } = await admin.from("factories").select("id").eq("slug", slug).limit(1).maybeSingle();
    const id = (data as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}
