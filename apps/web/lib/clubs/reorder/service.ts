import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { RELEASE_NOT_FOUND, getRelease, type StoredRelease } from "@/lib/releases/service";
import { throwIfFailed } from "../errors";

const projectOf = z.object({ project_id: z.uuid() });

/** The release by its id alone, for the club's order history, which knows the release and not yet the design. */
export async function findRelease(client: SupabaseClient, brandId: string, releaseId: string): Promise<StoredRelease & { readonly projectId: string }> {
  const { data, error } = await client.from("production_releases").select("project_id").eq("id", releaseId).eq("brand_id", brandId).maybeSingle();
  throwIfFailed(error, RELEASE_NOT_FOUND);
  if (!data) throw new AppError("not_found", RELEASE_NOT_FOUND);
  const { project_id: projectId } = projectOf.parse(data);
  return { ...(await getRelease(client, brandId, projectId, releaseId)), projectId };
}
