import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { itemsFrom, type MoodboardItemInput } from "./moodboard";
import type { MoodboardItem, TagSteer } from "./types";
import { TAG_STATES } from "./vocabulary";

/**
 * The moodboard and the steered tags in the database (decision 0082). Reads go through the member's own client, so
 * row level security decides what they see; writes go through the server's client and the three functions, which
 * check the membership and the design again. The brand and the person always come from the session.
 */

const HINTS: Readonly<Record<string, string>> = {
  not_a_reference: "Only a picture a provider serves can be saved to a moodboard; nothing is copied here.",
  moodboard_full: "A moodboard holds 60 items. Remove one to save another.",
  too_many_tags: "A design keeps 40 steered tags at most.",
  invalid_tag: "A tag is 1 to 40 characters.",
  invalid_state: "A tag is pinned or removed.",
};

const NOT_FOUND = "That design does not exist.";

/** Reads a database fault as something the person can be told, or as an internal fault. */
export function failure(error: Readonly<{ code?: string; hint?: string | null; message?: string }>): AppError {
  const hinted = error.hint ? HINTS[error.hint] : undefined;
  if (hinted) return new AppError("conflict", hinted);
  if (error.code === "P0002") return new AppError("not_found", NOT_FOUND);
  if (error.code === "22023") return new AppError("invalid_input", NOT_FOUND);
  return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
}

/** The saved items of one design's moodboard, newest first. */
export async function readMoodboard(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly MoodboardItem[]> {
  const board = await client.from("design_moodboards").select("id").eq("brand_id", brandId).eq("project_id", projectId).maybeSingle();
  if (board.error) throw failure(board.error);
  if (!board.data) return [];
  const { data, error } = await client
    .from("moodboard_items")
    .select("id, source, title, open_url, preview_url, attribution, added_at")
    .eq("brand_id", brandId)
    .eq("moodboard_id", z.object({ id: z.uuid() }).parse(board.data).id)
    .order("added_at", { ascending: false });
  if (error) throw failure(error);
  return itemsFrom(
    (data ?? []).map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      openUrl: row.open_url,
      previewUrl: row.preview_url,
      attribution: row.attribution,
      addedAt: row.added_at,
    })),
  );
}

/** Saves one card. The same address twice is one item: the function answers with the one already there. */
export async function saveItem(
  admin: SupabaseClient,
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  item: MoodboardItemInput,
): Promise<string> {
  const { data, error } = await admin.rpc("save_moodboard_item", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_project_id: projectId,
    p_source: item.source,
    p_title: item.title,
    p_open_url: item.openUrl,
    p_preview_url: item.previewUrl,
    p_attribution: item.attribution,
  });
  if (error) throw failure(error);
  return z.uuid().parse(data);
}

/** Removes one saved item. False when there was nothing to remove. */
export async function removeItem(admin: SupabaseClient, who: Readonly<{ brandId: string; userId: string }>, itemId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("remove_moodboard_item", { p_brand_id: who.brandId, p_user_id: who.userId, p_item_id: itemId });
  if (error) throw failure(error);
  return z.boolean().parse(data);
}

const steerRow = z.object({ tag: z.string(), state: z.enum(TAG_STATES) });

/** The tags this design's board has pinned or removed. */
export async function readSteer(client: SupabaseClient, brandId: string, projectId: string): Promise<TagSteer> {
  const { data, error } = await client.from("inspiration_tag_steers").select("tag, state").eq("brand_id", brandId).eq("project_id", projectId);
  if (error) throw failure(error);
  const steer: Record<string, "pinned" | "removed"> = {};
  for (const row of data ?? []) {
    const parsed = steerRow.safeParse(row);
    if (parsed.success) steer[parsed.data.tag] = parsed.data.state;
  }
  return steer;
}

/** Pins or removes one tag, or clears the steer when `state` is null. */
export async function writeSteer(
  admin: SupabaseClient,
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  tag: string,
  state: "pinned" | "removed" | null,
): Promise<void> {
  const { error } = await admin.rpc("set_inspiration_tag", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_project_id: projectId,
    p_tag: tag,
    p_state: state,
  });
  if (error) throw failure(error);
}
