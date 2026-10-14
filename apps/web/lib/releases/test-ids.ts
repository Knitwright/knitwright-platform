import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIKE_OFF_PREFIX = "strike-off-";
const MISSING_TABLE = "42P01";

type Ids = readonly string[];

/** The ids a strike-off shrink test is saved under: `strike-off-` and the strike-off's own id. */
async function strikeOffTests(client: SupabaseClient, brandId: string, projectId: string, wanted: Ids): Promise<Ids> {
  const ids = wanted.filter((t) => t.startsWith(STRIKE_OFF_PREFIX)).map((t) => t.slice(STRIKE_OFF_PREFIX.length));
  if (ids.length === 0) return [];
  const found = await client.from("strike_offs").select("id").eq("brand_id", brandId).eq("project_id", projectId).in("id", ids);
  if (found.error) throw new AppError("not_found", "A fabric test could not be checked.");
  return (found.data ?? []).map((r: { id: string }) => `${STRIKE_OFF_PREFIX}${r.id}`);
}

/** Fabric tests in the fabric library. Before that library is installed there are none. */
async function libraryTests(client: SupabaseClient, brandId: string, wanted: Ids): Promise<Ids> {
  const ids = wanted.filter((t) => !t.startsWith(STRIKE_OFF_PREFIX));
  if (ids.length === 0) return [];
  const found = await client.from("fabric_tests").select("id").eq("brand_id", brandId).in("id", ids);
  if (found.error?.code === MISSING_TABLE) return [];
  if (found.error) throw new AppError("not_found", "A fabric test could not be checked.");
  return (found.data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Refuses a release that names a fabric test of another brand, or none at all. Each id must be a
 * test record of this brand: a shrink measured on one of this design's strike-offs, or a test in
 * the brand's fabric library.
 */
export async function checkFabricTestIds(client: SupabaseClient, brandId: string, projectId: string, testIds: Ids): Promise<void> {
  if (testIds.length === 0) return;
  const malformed = testIds.filter((t) => !(t.startsWith(STRIKE_OFF_PREFIX) ? UUID.test(t.slice(STRIKE_OFF_PREFIX.length)) : UUID.test(t)));
  const unique = [...new Set(testIds)].filter((t) => !malformed.includes(t));
  const known = new Set([...(await strikeOffTests(client, brandId, projectId, unique)), ...(await libraryTests(client, brandId, unique))]);
  const unknown = [...malformed, ...unique.filter((t) => !known.has(t))];
  if (unknown.length > 0) {
    throw new AppError("invalid_input", `These fabric tests are not tests of this brand: ${unknown.join(", ")}. Remove them from the release.`);
  }
}
