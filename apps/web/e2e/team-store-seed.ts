import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { userIdOf } from "./support";

/**
 * Seeds a club's team store the way the server opens one (decision 0153), for the browser test of buying from it.
 * Opening a store from the Order drawer needs a design with a signed-off golden sample and a price ladder, which is
 * the make flow's own test; this is about the buyer, so the store is opened through the database function directly.
 */

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const must = <T>(answer: { data: T | null; error: { message: string } | null }): T => {
  if (answer.error) throw new Error(answer.error.message);
  return answer.data as T;
};

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

export type SeededStore = Readonly<{ brandId: string; code: string; storeId: string; slug: string }>;

/** An open store of the club of `email`, at £29.00 a piece plus a 10% margin, and the club's published page. */
export async function seedTeamStore(email: string, title: string): Promise<SeededStore> {
  const db = admin();
  const userId = await userIdOf(email);
  const { brand_id: brandId } = must(await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single()) as { brand_id: string };
  const projectId = must(await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: title, p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const release = must(await db.rpc("create_release", { p_project_id: projectId, p_brand_id: brandId, p_user_id: userId, p_label: "v1", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const productId = must(await db.rpc("create_brand_product", { p_brand_id: brandId, p_user_id: userId, p_project_id: projectId, p_name: title })) as string;
  const code = randomBytes(8).toString("hex").slice(0, 10);
  const storeId = must(await db.rpc("open_team_store", {
    p_brand_id: brandId, p_user_id: userId, p_code: code, p_title: title, p_project_id: projectId, p_product_id: productId, p_release_id: release[0]!.id,
    p_factory_profile_id: "knitwright-default", p_fabric_key: `e2e-${randomUUID().slice(0, 8)}`, p_flags: [], p_currency: "GBP", p_unit_minor: 2900,
    p_price_label: "Placeholder price for the browser test", p_margin_bps: 1000, p_sizes: ["S", "M", "L"], p_names_numbers: true, p_name_max: 12,
    p_min_pieces: 10, p_season_id: null, p_opens_at: new Date(Date.now() - 60_000).toISOString(), p_closes_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  })) as string;
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  must(await db.rpc("set_club_page", { p_brand_id: brandId, p_user_id: userId, p_slug: slug, p_contact: "kit@e2e.example", p_published: true }));
  return { brandId, code, storeId, slug };
}
