import { z } from "zod";
import { POSE_KINDS, PRESET_SOURCES, SHOOT_ASPECTS, SHOOT_JOB_STATUSES, SHOOT_STYLES, type ModelPreset, type ShootConcept, type ShootPose } from "./types";

/**
 * THE ONE DOOR OUT OF THE DATABASE (the shape `lib/mockups/schemas.ts` set).
 *
 * A row read back is checked here and nowhere else, and a row that does not parse is **left out**
 * rather than shown half-made: a shoot idea missing its poses would be a card whose Generate button
 * could not work, which is worse than one card fewer.
 *
 * zod lives here on purpose, so a client panel can import the concepts, the presets and the words
 * without carrying a schema into the browser (`tests/architecture/client-weight.test.ts`).
 */

const slug = z.string().min(1).max(64);
const words = z.string().min(1);

const poseRow = z.object({
  key: slug,
  kind: z.enum(POSE_KINDS),
  label: words,
  prompt: words,
  needs_person: z.boolean(),
  source: z.enum(PRESET_SOURCES),
  rule_id: words,
  note: words,
});

const presetRow = z.object({
  key: slug,
  label: words,
  body_type: words,
  age_band: words,
  skin_tone: words,
  licence_ref: z.string().nullable(),
  licence_holder: z.string().nullable(),
  rule_id: words,
  note: words,
});

const conceptRow = z.object({
  slug,
  title: words,
  lead: words,
  scene_slugs: z.array(slug).min(1),
  lighting: words,
  pose_keys: z.array(slug).min(1),
  camera_keys: z.array(slug).min(1),
  model_preset_keys: z.array(slug),
  style: z.enum(SHOOT_STYLES),
  outputs_count: z.number().int().min(1).max(4),
  aspects: z.array(z.enum(SHOOT_ASPECTS)).min(1),
  needs_model: z.boolean(),
  sport_tags: z.array(z.string()),
  mood_tags: z.array(z.string()),
  rule_id: words,
  note: words,
});

export const jobRow = z.object({
  id: z.uuid(),
  board_id: z.uuid(),
  scene_slug: slug,
  concept_slug: z.string().nullable(),
  status: z.enum(SHOOT_JOB_STATUSES),
  attempts: z.number().int(),
  checker_verdict: z.enum(["kept", "turned_away"]).nullable(),
  checker_failed: z.array(z.string()),
  moderation: z.enum(["clear", "flagged", "blocked"]).nullable(),
  credits: z.number().int(),
  refunded_credits: z.number().int(),
  output_file_id: z.string().nullable(),
  message: z.string().nullable(),
  model_source: z.enum(["none", "preset", "upload"]),
  created_at: z.string(),
  finished_at: z.string().nullable(),
});

export type ShootJobRow = z.infer<typeof jobRow>;

/** The columns each read asks for, written once so a read and its schema cannot drift apart. */
export const POSE_COLUMNS = "key, kind, label, prompt, needs_person, source, rule_id, note, sort";
export const PRESET_COLUMNS = "key, label, body_type, age_band, skin_tone, licence_ref, licence_holder, rule_id, note, sort";
export const CONCEPT_COLUMNS =
  "slug, title, lead, scene_slugs, lighting, pose_keys, camera_keys, model_preset_keys, style, outputs_count, aspects, needs_model, sport_tags, mood_tags, rule_id, note, sort";
export const JOB_COLUMNS =
  "id, board_id, scene_slug, concept_slug, status, attempts, checker_verdict, checker_failed, moderation, credits, refunded_credits, output_file_id, message, model_source, created_at, finished_at";

/** One pose or camera row as the panel's own value, or null when the row cannot be read. */
export function poseFromRow(value: unknown): ShootPose | null {
  const parsed = poseRow.safeParse(value);
  if (!parsed.success) return null;
  const row = parsed.data;
  return { key: row.key, kind: row.kind, label: row.label, prompt: row.prompt, needsPerson: row.needs_person, source: row.source, ruleId: row.rule_id, note: row.note };
}

export function presetFromRow(value: unknown): ModelPreset | null {
  const parsed = presetRow.safeParse(value);
  if (!parsed.success) return null;
  const row = parsed.data;
  return {
    key: row.key,
    label: row.label,
    bodyType: row.body_type,
    ageBand: row.age_band,
    skinTone: row.skin_tone,
    licenceRef: row.licence_ref === null || row.licence_ref.trim() === "" ? null : row.licence_ref,
    licenceHolder: row.licence_holder === null || row.licence_holder.trim() === "" ? null : row.licence_holder,
    ruleId: row.rule_id,
    note: row.note,
  };
}

export function conceptFromRow(value: unknown): ShootConcept | null {
  const parsed = conceptRow.safeParse(value);
  if (!parsed.success) return null;
  const row = parsed.data;
  return {
    slug: row.slug,
    title: row.title,
    lead: row.lead,
    sceneSlugs: row.scene_slugs,
    lighting: row.lighting,
    cameraKeys: row.camera_keys,
    poseKeys: row.pose_keys,
    modelPresetKeys: row.model_preset_keys,
    style: row.style,
    outputs: { count: row.outputs_count, aspects: row.aspects },
    needsModel: row.needs_model,
    sports: row.sport_tags,
    moods: row.mood_tags,
    ruleId: row.rule_id,
    note: row.note,
  };
}
