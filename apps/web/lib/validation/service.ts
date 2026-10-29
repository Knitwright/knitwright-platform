import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { DEFAULT_PROFILE_LABEL, defaultFactoryProfile, factoryProfileSchema, type FactoryProfile } from "./profile";
import { DRAFT, versionStatusSchema, type StatusRecord, type VersionStatus } from "./status";

export const DEFAULT_PROFILE_ID = "knitwright-default";
const NOT_FOUND = "That design does not exist.";

const profileRow = z.object({ id: z.string(), profile: z.unknown() });

/**
 * The factory profile a design is checked against. The seeded default is built from the garment
 * registry each time, so a new garment is listed without a migration. Any other row is read as stored.
 */
export async function loadFactoryProfile(client: SupabaseClient, id: string = DEFAULT_PROFILE_ID): Promise<FactoryProfile> {
  if (id === DEFAULT_PROFILE_ID) return withOwnerTerms(client, defaultFactoryProfile());
  const { data, error } = await client.from("factory_profiles").select("id, profile").eq("id", id).maybeSingle();
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  if (!data) throw new AppError("not_found", "That factory profile does not exist.");
  return factoryProfileSchema.parse(profileRow.parse(data).profile);
}

/**
 * The default profile with the terms a platform admin set in the settings console (lib/settings) laid over it. The
 * console keeps the result in the seeded row; while that row still carries the default label, or cannot be read,
 * the in-code default is used unchanged. The article list always comes from the registry, so a new garment appears
 * without a migration.
 */
async function withOwnerTerms(client: SupabaseClient, base: FactoryProfile): Promise<FactoryProfile> {
  const { data, error } = await client.from("factory_profiles").select("id, profile").eq("id", DEFAULT_PROFILE_ID).maybeSingle();
  if (error || !data) return base;
  const stored = factoryProfileSchema.safeParse(profileRow.parse(data).profile);
  if (!stored.success || stored.data.label === DEFAULT_PROFILE_LABEL) return base;
  const moq = new Map(stored.data.articles.map((a) => [a.typeId, a.moq]));
  return { ...stored.data, articles: base.articles.map((a) => ({ ...a, moq: moq.get(a.typeId) ?? a.moq })) };
}

const statusRow = z.object({
  status: versionStatusSchema,
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
  status_move: "That move is not allowed. A version goes through a factory profile before it is accepted for ordering, or ordered.",
  status_approved: "A version accepted for ordering can only be ordered. Change the design to start a new draft.",
};

/** Stores a status the app has already decided on. Only the server's own client may call it. */
export async function writeDesignStatus(
  admin: SupabaseClient,
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  version: number,
  to: VersionStatus,
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
