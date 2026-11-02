import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_SHOOT_CONCEPTS } from "./concepts";
import { MODEL_PRESET_CATALOGUE } from "./models";
import { ALL_SHOOT_POSES } from "./poses";
import type { ModelPreset, ShootConcept, ShootPose } from "./types";

/**
 * THE SEED: the shoot ideas, the presets and the people, as rows (plan v5 L3).
 *
 * The one place each of them is written down is `concepts.ts`, `poses.ts` and `models.ts`, and
 * these rows are made from those, exactly as the credit prices are set in one file and seeded from
 * it (20261025060000_credits.sql). `migration.test.ts` fails when the file and the migration
 * disagree about the values a column allows.
 *
 * **Nothing here writes a licence reference.** A preset is seeded with `licence_ref` null and the
 * refs are a platform setting an admin fills in (`settings.ts`), so running the seed again can
 * never undo somebody's licence or quietly grant one.
 *
 * The order matters: a concept names poses, cameras and presets, and the trigger
 * `shoot_concepts_presets_are_known` refuses a concept whose rows are not there yet.
 */

export const poseRow = (pose: ShootPose, sort: number) => ({
  key: pose.key,
  kind: pose.kind,
  label: pose.label,
  prompt: pose.prompt,
  needs_person: pose.needsPerson,
  source: pose.source,
  note: pose.note,
  rule_id: pose.ruleId,
  sort,
});

/** A preset row. `licence_ref` is left out of the write entirely: the setting owns it. */
export const presetRow = (preset: ModelPreset, sort: number) => ({
  key: preset.key,
  label: preset.label,
  body_type: preset.bodyType,
  age_band: preset.ageBand,
  skin_tone: preset.skinTone,
  note: preset.note,
  rule_id: preset.ruleId,
  sort,
});

export const conceptRow = (concept: ShootConcept, sort: number) => ({
  slug: concept.slug,
  title: concept.title,
  lead: concept.lead,
  scene_slugs: [...concept.sceneSlugs],
  lighting: concept.lighting,
  pose_keys: [...concept.poseKeys],
  camera_keys: [...concept.cameraKeys],
  model_preset_keys: [...concept.modelPresetKeys],
  style: concept.style,
  outputs_count: concept.outputs.count,
  aspects: [...concept.outputs.aspects],
  needs_model: concept.needsModel,
  sport_tags: [...concept.sports],
  mood_tags: [...concept.moods],
  note: concept.note,
  rule_id: concept.ruleId,
  sort,
});

export const shootPoseRowsFor = (poses: readonly ShootPose[] = ALL_SHOOT_POSES) => poses.map(poseRow);
export const modelPresetRowsFor = (presets: readonly ModelPreset[] = MODEL_PRESET_CATALOGUE) => presets.map(presetRow);
export const shootConceptRowsFor = (concepts: readonly ShootConcept[] = ALL_SHOOT_CONCEPTS) => concepts.map(conceptRow);

/**
 * Puts the library in the database with the service client. A row is found by its key or slug, so
 * running this again changes the rows it made and adds nothing.
 */
export async function seedShootLibrary(admin: SupabaseClient): Promise<Readonly<{ poses: number; presets: number; concepts: number }>> {
  const poses = shootPoseRowsFor();
  const presets = modelPresetRowsFor();
  const concepts = shootConceptRowsFor();
  await upsert(admin, "shoot_poses", poses, "key");
  await upsert(admin, "model_presets", presets, "key");
  await upsert(admin, "shoot_concepts", concepts, "slug");
  return { poses: poses.length, presets: presets.length, concepts: concepts.length };
}

async function upsert(admin: SupabaseClient, table: string, rows: readonly unknown[], onConflict: string): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from(table).upsert(rows as never[], { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}
