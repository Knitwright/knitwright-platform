import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBundles, bundleRowOf, memberRowsOf } from "./build";

/**
 * Puts the kit bundles in the library with the service client (plan v5 L8, decision 0098). A bundle is
 * found by its slug, so running this again changes the rows it made and adds nothing.
 *
 * **Seed the design templates first** (`seedTemplates`): a member names a design by its slug and the
 * database holds it to a real row, so a bundle cannot be written before the designs it is made of.
 * The members of a bundle are written again from scratch each time, because a bundle's membership is
 * the whole of what it is and a member row has no name of its own to find it by.
 */
export async function seedKitBundles(admin: SupabaseClient): Promise<number> {
  const bundles = buildBundles();
  const { error: bundleError } = await admin.from("template_kit_bundles").upsert(bundles.map(bundleRowOf), { onConflict: "slug" });
  if (bundleError) throw new Error(bundleError.message);

  const slugs = bundles.map((bundle) => bundle.slug);
  const { error: clearError } = await admin.from("template_kit_bundle_members").delete().in("bundle_slug", slugs);
  if (clearError) throw new Error(clearError.message);

  const members = bundles.flatMap(memberRowsOf);
  const { error: memberError } = await admin.from("template_kit_bundle_members").insert(members);
  if (memberError) throw new Error(memberError.message);
  return bundles.length;
}
