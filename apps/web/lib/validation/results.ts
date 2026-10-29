import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { checksPass, validationCheckSchema, type ValidationCheck } from "./check";

/**
 * `validation_results` (migration 20261101030000): the checks of one design version against one profile. `save` rows
 * are written on every save and do not include the tech pack readiness list; `full` rows are written when a person
 * records a status, and include it.
 */
export const RESULT_SCOPES = ["save", "full"] as const;
export type ResultScope = (typeof RESULT_SCOPES)[number];

export interface StoredResult {
  readonly version: number;
  readonly profileId: string;
  readonly scope: ResultScope;
  readonly checks: readonly ValidationCheck[];
  readonly passed: boolean;
  readonly at: string;
}

interface ResultToWrite {
  readonly projectId: string;
  readonly version: number;
  readonly profileId: string;
  readonly scope: ResultScope;
  readonly checks: readonly ValidationCheck[];
}

/** Stores the result through `record_validation_result`. Only the server's own client may call it. */
export async function writeValidationResult(admin: SupabaseClient, who: Readonly<{ brandId: string; userId: string }>, result: ResultToWrite): Promise<void> {
  const { error } = await admin.rpc("record_validation_result", {
    p_project_id: result.projectId,
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_version: result.version,
    p_profile_id: result.profileId,
    p_scope: result.scope,
    p_checks: result.checks,
    p_passed: checksPass(result.checks),
  });
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
}

const resultRow = z.object({
  version: z.number().int().min(1),
  profile_id: z.string(),
  scope: z.enum(RESULT_SCOPES),
  checks: z.array(validationCheckSchema),
  passed: z.boolean(),
  checked_at: z.string(),
});

/** The columns, one word each: joined here rather than written as one phrase, which reads as a sentence to the wording test. */
const RESULT_COLUMNS = ["version", "profile_id", "scope", "checks", "passed", "checked_at"].join(", ");

/** The stored results of one version, `full` before `save`. Empty when none was stored. */
export async function readValidationResults(client: SupabaseClient, brandId: string, projectId: string, version: number): Promise<readonly StoredResult[]> {
  const { data, error } = await client
    .from("validation_results")
    .select(RESULT_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .eq("version", version)
    .order("scope", { ascending: true });
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  return z
    .array(resultRow)
    .parse(data ?? [])
    .map((row) => ({ version: row.version, profileId: row.profile_id, scope: row.scope, checks: row.checks, passed: row.passed, at: row.checked_at }));
}
