import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";

const PROJECT_NOT_FOUND = "That design does not exist.";

/** Throws unless the design belongs to the brand. Another brand's design and a missing one read alike. */
export async function assertProjectOfBrand(client: SupabaseClient, brandId: string, projectId: string): Promise<void> {
  const found = await client.from("projects").select("id").eq("id", projectId).eq("brand_id", brandId).maybeSingle();
  if (found.error || !found.data) throw new AppError("not_found", PROJECT_NOT_FOUND);
}
