import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkerVerdictSchema, mediaKindSchema, mediaViewSchema, setStatusSchema } from "./contract";
import type { ItemRecord, MediaFiles, MediaStore, SetRecord } from "./ports";
import { storeImage } from "@/lib/storage/store";

/**
 * Media sets in the database and storage. A set is read with the user's own client, so the database's rules decide; its items are read with the server's key,
 * because members hold no grant on an item's cost, provider or clean path (migration 20261030010000). Writes go through the functions of migration 20261027010000, with the server's key: no browser
 * may write a set, an item or a history line.
 */

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

const itemRow = z.object({
  id: z.uuid(),
  kind: mediaKindSchema,
  view: mediaViewSchema,
  file_id: z.uuid().nullable(),
  clean_path: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  checker_verdict: checkerVerdictSchema,
  provider: z.string(),
  cost_microdollars: z.coerce.number(),
});

const setRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  project_id: z.uuid(),
  version: z.number().int(),
  version_hash: z.string(),
  status: setStatusSchema,
  error: z.string().nullable(),
  unlocked_at: z.string().nullable(),
  media_items: z.array(itemRow),
});

const SET_COLUMNS = "id, brand_id, project_id, version, version_hash, status, error, unlocked_at";
const ITEM_COLUMNS = "id, kind, view, file_id, clean_path, width, height, checker_verdict, provider, cost_microdollars";

const KIND_ORDER = ["front", "back", "flat_lay", "three_quarter", "on_model", "scene"];

const toRecord = (raw: unknown): SetRecord => {
  const row = setRow.parse(raw);
  const items: ItemRecord[] = row.media_items
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      view: item.view,
      fileId: item.file_id,
      cleanPath: item.clean_path,
      width: item.width,
      height: item.height,
      checker: item.checker_verdict,
      provider: item.provider,
      costMicrodollars: item.cost_microdollars,
    }))
    .sort((a, b) => KIND_ORDER.indexOf(a.view) - KIND_ORDER.indexOf(b.view));
  return {
    id: row.id,
    brandId: row.brand_id,
    projectId: row.project_id,
    version: row.version,
    versionHash: row.version_hash,
    status: row.status,
    error: row.error,
    unlocked: row.unlocked_at !== null,
    items,
  };
};

/**
 * A set found through the member's client (so row level security still decides whose it is), with its items read with the
 * server's key for that set and brand: members hold no grant on an item's cost, provider or clean path.
 */
async function withItems(admin: SupabaseClient, brandId: string, set: { id: string }): Promise<SetRecord> {
  const { data, error } = await admin.from("media_items").select(ITEM_COLUMNS).eq("brand_id", brandId).eq("set_id", set.id);
  failIf(error, "The media items could not be read.");
  return toRecord({ ...set, media_items: data ?? [] });
}

export function mediaStore(admin: SupabaseClient, client: SupabaseClient): MediaStore {
  return {
    async start(input) {
      const { data, error } = await admin.rpc("media_set_start", {
        p_brand_id: input.brandId,
        p_project_id: input.projectId,
        p_user_id: input.userId,
        p_version: input.version,
        p_version_hash: input.versionHash,
      });
      failIf(error, "The media set could not be recorded.");
      return z.object({ id: z.uuid(), created: z.boolean() }).parse(data);
    },
    async move(setId, from, to, message) {
      const { data, error } = await admin.rpc("media_set_move", { p_set_id: setId, p_from: [...from], p_to: to, p_error: message ?? null });
      failIf(error, "The media set could not be updated.");
      return data === true;
    },
    async putItem(setId, item) {
      const { data, error } = await admin.rpc("media_item_put", {
        p_set_id: setId,
        p_kind: item.kind,
        p_view: item.view,
        p_file_id: item.fileId,
        p_clean_path: item.cleanPath,
        p_width: item.width,
        p_height: item.height,
        p_provider: item.provider,
        p_cost_microdollars: item.costMicrodollars,
        p_verdict: item.checker,
      });
      failIf(error, "The media item could not be recorded.");
      return z.uuid().parse(data);
    },
    async unlock(setId, userId) {
      const { data, error } = await admin.rpc("media_set_unlock", { p_set_id: setId, p_user_id: userId });
      failIf(error, "The media set could not be unlocked.");
      return data === true;
    },
    async read(brandId, projectId, setId) {
      const { data, error } = await client.from("media_sets").select(SET_COLUMNS).eq("brand_id", brandId).eq("project_id", projectId).eq("id", setId).maybeSingle();
      failIf(error, "The media set could not be read.");
      return data ? withItems(admin, brandId, data) : null;
    },
    async latest(brandId, projectId) {
      const { data, error } = await client.from("media_sets").select(SET_COLUMNS).eq("brand_id", brandId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      failIf(error, "The media sets could not be read.");
      return data ? withItems(admin, brandId, data) : null;
    },
  };
}

const BUCKET = "images";

/**
 * Pictures of one brand. The watermarked picture is an ordinary file of the brand (the server's key stores it, the
 * member's client reads it). The clean one is written and read only with the server's key, outside the brand's folder.
 */
export function mediaFiles(admin: SupabaseClient, client: SupabaseClient, who: Readonly<{ brandId: string; userId: string }>): MediaFiles {
  return {
    async saveWatermarked(png) {
      return (await storeImage({ admin, brandId: who.brandId, userId: who.userId, kind: "render", bytes: png, statedType: "image/png" })).id;
    },
    async saveClean(path, png) {
      const { error } = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
      failIf(error, "The picture could not be stored.");
    },
    async readWatermarked(fileId) {
      const { data: row } = await client.from("files").select("bucket, path").eq("id", fileId).eq("brand_id", who.brandId).maybeSingle();
      const found = z.object({ bucket: z.string(), path: z.string() }).safeParse(row);
      if (!found.success) return null;
      const download = await client.storage.from(found.data.bucket).download(found.data.path);
      return download.error || !download.data ? null : new Uint8Array(await download.data.arrayBuffer());
    },
    async readClean(path) {
      // A path outside this brand's private folder is never read, whatever a caller passes.
      if (!path.startsWith(`_private/${who.brandId}/`)) return null;
      const download = await admin.storage.from(BUCKET).download(path);
      return download.error || !download.data ? null : new Uint8Array(await download.data.arrayBuffer());
    },
    async remove({ fileIds, cleanPaths }) {
      if (cleanPaths.length > 0) failIf((await admin.storage.from(BUCKET).remove([...cleanPaths])).error, "The pictures could not be removed.");
      if (fileIds.length === 0) return;
      const { data, error } = await admin.from("files").select("id, path").eq("brand_id", who.brandId).eq("kind", "render").in("id", [...fileIds]);
      failIf(error, "The pictures could not be found.");
      const rows = z.array(z.object({ id: z.uuid(), path: z.string() })).parse(data ?? []);
      if (rows.length === 0) return;
      failIf((await admin.storage.from(BUCKET).remove(rows.map((row) => row.path))).error, "The pictures could not be removed.");
      failIf((await admin.from("files").delete().in("id", rows.map((row) => row.id))).error, "The pictures' records could not be removed.");
    },
  };
}
