import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { sceneFromSnapshot } from "./schemas";
import type { MockupScene } from "./types";

/**
 * Reading the mockup scenes (plan v5 L2).
 *
 * The library is platform data, so it is read with the signed-in member's own client and the
 * database's own rules decide what they see, exactly as the design library is read
 * (`lib/templates/service.ts`). Nothing here writes: the seed is the one writer, with the server's
 * key.
 *
 * The read asks for `kind = 'mockup_scene'` and nothing else, which is the other half of L8's
 * warning: a reader that expects one kind of row says which kind it wants.
 */

/** `07` asks for 40 scenes; the read is bounded well above that so a stray row cannot hide one. */
const SCENE_READ_LIMIT = 200;

const COLUMNS = "id, slug, title, snapshot, review_state";

const row = z.object({ id: z.uuid(), slug: z.string(), title: z.string(), snapshot: z.unknown(), review_state: z.string() });

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/** One scene as the library holds it: the row's own id beside the scene in its snapshot. */
export interface StoredScene {
  readonly id: string;
  readonly scene: MockupScene;
  readonly reviewed: boolean;
}

/**
 * Every mockup scene in the library, in slug order. A row whose snapshot is not a scene is left out
 * rather than shown half-drawn, and `unreadable` counts how many were.
 */
export async function loadMockupScenes(client: SupabaseClient): Promise<{ readonly scenes: readonly StoredScene[]; readonly unreadable: number }> {
  const { data, error } = await client.from("templates").select(COLUMNS).eq("kind", "mockup_scene").order("slug").limit(SCENE_READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(row).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  const scenes: StoredScene[] = [];
  let skipped = 0;
  for (const entry of parsed.data) {
    const scene = sceneFromSnapshot(entry.snapshot);
    if (scene === null) skipped += 1;
    else scenes.push({ id: entry.id, scene, reviewed: entry.review_state === "reviewed" });
  }
  return { scenes, unreadable: skipped };
}

/** One scene by its slug, or null. Used when a board names a scene that may have been withdrawn. */
export async function loadMockupScene(client: SupabaseClient, slug: string): Promise<StoredScene | null> {
  const { data, error } = await client.from("templates").select(COLUMNS).eq("kind", "mockup_scene").eq("slug", slug).maybeSingle();
  if (error) throw unreadable(error);
  const parsed = row.nullish().safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  if (!parsed.data) return null;
  const scene = sceneFromSnapshot(parsed.data.snapshot);
  return scene === null ? null : { id: parsed.data.id, scene, reviewed: parsed.data.review_state === "reviewed" };
}
