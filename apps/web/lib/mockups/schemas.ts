import { z } from "zod";
import { BACKDROP_KINDS, CHART_CARDS, CROPS, GARMENT_VIEWS, PEOPLE_BANDS, PRESENTATIONS, SCENE_GROUPS, SCENE_OWNERS, SCENE_SOURCES, type MockupScene } from "./types";

/**
 * The shape a mockup scene is stored in, and the one door back out of the database.
 *
 * A scene lives in the `snapshot` of a `templates` row of kind `mockup_scene`: platform data, read
 * by every signed-in member, written only by the server's own key, exactly as a design template is
 * (migration 20261025030000, column grants 20261030020000). `snapshot` already carries that grant,
 * so nothing here needs a new column -- which is the trap L8 warned about, since a column added
 * later has no grant at all and a read naming it is refused for the whole table.
 *
 * Zod lives in this file and not in `index.ts`, so a client component that shows a scene does not
 * carry 350 KB of schema into the browser (`tests/architecture/client-weight.test.ts`).
 */

const FRACTION = z.number().min(0).max(1);

const frame = z.object({ x: FRACTION, y: FRACTION, width: z.number().gt(0).max(1), height: z.number().gt(0).max(1) });

const slot = z.object({
  index: z.number().int().min(1).max(11),
  view: z.enum(GARMENT_VIEWS),
  presentation: z.enum(PRESENTATIONS),
  pose: z.string().min(1).max(120),
  camera: z.string().min(1).max(120),
  frame,
});

const backdrop = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  kind: z.enum(BACKDROP_KINDS),
  hex: z.string().regex(/^#[0-9a-f]{6}$/),
  hexTwo: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
  note: z.string().min(1).max(200),
});

/** The scene a `templates.snapshot` holds. Every field is required: a half-written scene is no scene. */
export const mockupSceneSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  title: z.string().min(1).max(120),
  group: z.enum(SCENE_GROUPS),
  source: z.enum(SCENE_SOURCES),
  slots: z.array(slot).min(1).max(11),
  backdrop,
  lighting: z.string().min(1).max(160),
  crops: z.array(z.enum(CROPS)).min(1).max(4),
  people: z.enum(PEOPLE_BANDS),
  sports: z.array(z.string().min(1).max(40)).max(6),
  moods: z.array(z.string().min(1).max(40)).max(4),
  modelPresets: z.array(z.string().min(1).max(60)).max(12),
  card: z.enum(CHART_CARDS).nullable(),
  owner: z.enum(SCENE_OWNERS),
  ruleId: z.string().regex(/^R-[A-Z]+-\d{3}$/),
  note: z.string().min(1).max(400),
});

/**
 * The scene in a stored snapshot, or null when the row does not hold one. A row that cannot be read
 * is left out of the library rather than shown half-drawn: the library is platform data, and a
 * panel that guesses at a broken row is worse than a panel that shows one scene fewer.
 */
export function sceneFromSnapshot(snapshot: unknown): MockupScene | null {
  const parsed = mockupSceneSchema.safeParse(snapshot);
  return parsed.success ? (parsed.data as MockupScene) : null;
}

/**
 * What a run of a mockup board may send (the wiring of decision 0092). Two ids and nothing else:
 * the scene, the crop, the kit and the shirt are read off the board itself, so a request cannot ask
 * for a picture of settings nobody saved.
 */
export const renderMockupBoardBody = z.object({ launchProjectId: z.uuid(), boardId: z.uuid() });
export type RenderMockupBoardBody = z.output<typeof renderMockupBoardBody>;
