import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { designStatusSchema, type DesignStatus } from "@/lib/production/contract";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { defaultFactoryProfile, factoryProfileSchema, type FactoryProfile } from "./profile";
import { DRAFT, type StatusRecord } from "./status";

export const DEFAULT_PROFILE_ID = "knitwright-default";
const NOT_FOUND = "That design does not exist.";

const profileRow = z.object({ id: z.string(), profile: z.unknown() });

/**
 * The factory profile a design is checked against. The seeded default is built from the garment
 * registry each time, so a new garment is listed without a migration. Any other row is read as stored.
 */
export async function loadFactoryProfile(client: SupabaseClient, id: string = DEFAULT_PROFILE_ID): Promise<FactoryProfile> {
  if (id === DEFAULT_PROFILE_ID) return defaultFactoryProfile();
  const { data, error } = await client.from("factory_profiles").select("id, profile").eq("id", id).maybeSingle();
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  if (!data) throw new AppError("not_found", "That factory profile does not exist.");
  return factoryProfileSchema.parse(profileRow.parse(data).profile);
}

const statusRow = z.object({
  status: designStatusSchema,
  profile_id: z.string().nullable(),
  findings_hash: z.string().nullable(),
  changed_at: z.string(),
});

/** The status of one version. A version with no row is a draft. */
export async function readDesignStatus(client: SupabaseClient, brandId: string, projectId: string, version: number): Promise<StatusRecord> {
  const { data, error } = await client
    .from("design_statuses")
    .select("status, profile_id, findings_hash, changed_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  if (!data) return DRAFT;
  const row = statusRow.parse(data);
  return { status: row.status, profileId: row.profile_id, findingsHash: row.findings_hash, at: row.changed_at };
}

const HINTS: Readonly<Record<string, string>> = {
  status_ordered: "An ordered version can never change its status.",
  status_move: "A draft cannot be ordered. Check it against a factory profile first.",
};

/** Stores a status the app has already decided on. Only the server's own client may call it. */
export async function writeDesignStatus(
  admin: SupabaseClient,
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  version: number,
  to: DesignStatus,
  record: Pick<StatusRecord, "profileId" | "findingsHash">,
): Promise<void> {
  const { error } = await admin.rpc("set_design_status", {
    p_project_id: projectId,
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_version: version,
    p_status: to,
    p_profile_id: record.profileId,
    p_findings_hash: record.findingsHash,
  });
  if (!error) return;
  const hinted = error.hint ? HINTS[error.hint] : undefined;
  if (hinted) throw new AppError("conflict", hinted);
  if (error.code === "P0002" || error.code === "23503") throw new AppError("not_found", NOT_FOUND);
  throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
}
