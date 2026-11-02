import type { SupabaseClient } from "@supabase/supabase-js";
import { colourFamilyOf } from "@/lib/templates/colour-family";
import { ALL_MOCKUP_SCENES } from "./scenes";
import type { MockupScene, SceneGroup } from "./types";

/**
 * The mockup scenes as `templates` rows of kind `mockup_scene` (plan v5 L2; `07`'s own words:
 * "Mockup scene · A photographic or 3D scene that a design version is placed into").
 *
 * Three things from L8 (decision 0098) are obeyed here rather than discovered later:
 *
 *   1. `templates.kind` already exists with the seven values of `07`; nothing adds it again.
 *   2. `lib/templates/service.ts` read the whole table and parsed every row against the design
 *      shape, so **the same change that seeds these rows narrows `loadLibrary` to
 *      `kind = 'design'`**, or the design library page breaks on the first scene.
 *   3. `authenticated` holds SELECT on `templates` column by column. The scene goes in `snapshot`,
 *      which is already granted, so this workstream adds no column and needs no new grant.
 *
 * A scene is not a design, so two of the table's columns have nothing true to put in them:
 * `article_id` (a scene is not drawn on one article -- `07` gives it garment *slots*) and `wearer`.
 * The migration `20261201060000_mockup_scenes.sql` lets them be null for a row that is not a design
 * and keeps them required for one that is, rather than this file writing a garment type that the
 * scene is not for.
 */

/** Which of the five values the `sport` column allows a scene group sits under. */
const SPORT_OF_GROUP: Readonly<Record<SceneGroup, "football" | "cricket" | "running" | "training" | "general">> = {
  product: "general",
  teamwear: "football",
  training: "training",
  running: "running",
  // The `sport` column has no esports or combat; `sport_tags` carries those, as L8's migration says.
  combat: "general",
  esports: "general",
  retail: "general",
};

/** The row a scene is stored as. The scene itself is the snapshot; the columns are what search reads. */
export const mockupSceneRow = (scene: MockupScene) => ({
  slug: scene.slug,
  title: scene.title,
  kind: "mockup_scene",
  sport: SPORT_OF_GROUP[scene.group],
  article_id: null,
  wearer: null,
  // `07` groups scenes rather than styling them, so a scene's one style tag is its group.
  style_tags: [scene.group],
  colour_family: colourFamilyOf(scene.backdrop.hex) ?? "grey",
  sport_tags: [...scene.sports],
  era_tags: [] as readonly string[],
  mood_tags: [...scene.moods],
  snapshot: scene,
  source: "knitwright",
  review_state: "not_reviewed",
});

export const mockupSceneRows = (scenes: readonly MockupScene[] = ALL_MOCKUP_SCENES) => scenes.map(mockupSceneRow);

/**
 * Puts the mockup scenes in the library with the service client. A row is found by its slug, so
 * running this again changes the rows it made and adds nothing. A row a platform admin has reviewed
 * is left exactly as it is, as L8's own seed does.
 */
export async function seedMockupScenes(admin: SupabaseClient): Promise<number> {
  const rows = mockupSceneRows();
  const { data: reviewed, error: readError } = await admin.from("templates").select("slug").eq("review_state", "reviewed");
  if (readError) throw new Error(readError.message);
  const keep = new Set((reviewed ?? []).map((entry: { slug: string }) => entry.slug));
  const fresh = rows.filter((row) => !keep.has(row.slug));
  if (fresh.length === 0) return 0;
  const { error } = await admin.from("templates").upsert(fresh, { onConflict: "slug" });
  if (error) throw new Error(error.message);
  return fresh.length;
}
