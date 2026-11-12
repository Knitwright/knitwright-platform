import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { LINK_LIFETIME_SECONDS } from "@/lib/storage/links";
import { lifestyleOf, sceneOf, type Creation } from "./creations";
import { folderCounts, type FolderSummary, type ProjectItem } from "./items";
import { designRow, folderRow, itemsOf, launchRow, lifestyleRow, placementRow, sharedOf, sharedRow, shootRow, trashRow, type SharedItem } from "./rows";

/**
 * What the Projects page reads (decision 0139). Every read goes through the signed-in member's own
 * client, so the database's rules decide what they see, and each is bounded.
 */

/** The most designs, and the most launch projects, one page lists. */
export const ITEMS_READ = 500;
/** The most pictures AI Creations shows from each table. */
export const CREATIONS_READ = 60;

type Failing = Readonly<{ message: string }> | null;

const parsed = <T>(schema: z.ZodType<T>, data: unknown, error: Failing, what: string): T[] => {
  if (error) throw new Error(`The ${what} could not be read.`, { cause: error });
  const result = z.array(schema).safeParse(data ?? []);
  if (!result.success) throw new Error(`The ${what} came back in an unexpected shape.`, { cause: result.error });
  return result.data;
};

/** Every design and launch project of the brand, with its folder and whether it is in the Trash. */
export async function loadProjectItems(client: SupabaseClient, brandId: string): Promise<readonly ProjectItem[]> {
  const [designs, launches, placements, trash] = await Promise.all([
    client.from("projects").select("id, name, garment_type, created_at, updated_at").eq("brand_id", brandId).order("updated_at", { ascending: false }).limit(ITEMS_READ),
    client.from("launch_projects").select("id, name, created_at, updated_at, boards(id)").eq("brand_id", brandId).is("studio_project_id", null).order("updated_at", { ascending: false }).limit(ITEMS_READ),
    client.from("project_folder_items").select("folder_id, project_id, launch_project_id").eq("brand_id", brandId).limit(ITEMS_READ * 2),
    client.from("project_trash").select("project_id, launch_project_id, trashed_at").eq("brand_id", brandId).limit(ITEMS_READ * 2),
  ]);
  return itemsOf(
    parsed(designRow, designs.data, designs.error, "designs"),
    parsed(launchRow, launches.data, launches.error, "launch projects"),
    parsed(placementRow, placements.data, placements.error, "folders' contents"),
    parsed(trashRow, trash.data, trash.error, "Trash"),
  );
}

/** The brand's folders, each with how many projects are in it. */
export async function loadFolders(client: SupabaseClient, brandId: string, items: readonly ProjectItem[]): Promise<readonly FolderSummary[]> {
  const { data, error } = await client.from("project_folders").select("id, name, created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
  const rows = parsed(folderRow, data, error, "folders");
  return folderCounts(rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at })), items);
}

/** The open invites to other brands' designs sent to the signed-in person's address. */
export async function loadShared(client: SupabaseClient): Promise<readonly SharedItem[]> {
  const { data, error } = await client.rpc("shared_with_me");
  return parsed(sharedRow, data, error, "designs shared with you").map(sharedOf);
}

export interface ShownCreation extends Creation {
  /** A link that stops working after a minute, or null when storage gave none. */
  readonly url: string | null;
}

const fileRow = z.object({ id: z.uuid(), bucket: z.string(), path: z.string() });

/** Short-lived links to the pictures, made with the member's own client, a bucket at a time. */
async function signedLinks(client: SupabaseClient, brandId: string, fileIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (fileIds.length === 0) return new Map();
  const { data, error } = await client.from("files").select("id, bucket, path").eq("brand_id", brandId).in("id", [...fileIds]);
  const files = parsed(fileRow, data, error, "pictures' files");
  const links = new Map<string, string>();
  for (const bucket of new Set(files.map((file) => file.bucket))) {
    const inBucket = files.filter((file) => file.bucket === bucket);
    const signed = await client.storage.from(bucket).createSignedUrls(inBucket.map((file) => file.path), LINK_LIFETIME_SECONDS);
    if (signed.error) continue;
    for (const [index, entry] of signed.data.entries()) {
      if (entry.signedUrl) links.set(inBucket[index]!.id, entry.signedUrl);
    }
  }
  return links;
}

/** The brand's AI pictures, newest first, each with a link to draw it. */
export async function loadCreations(client: SupabaseClient, brandId: string): Promise<readonly ShownCreation[]> {
  const [shoots, lifestyle] = await Promise.all([
    client.from("shoot_jobs").select("id, launch_project_id, aspect, output_file_id, finished_at").eq("brand_id", brandId).eq("status", "ready").not("output_file_id", "is", null).order("finished_at", { ascending: false }).limit(CREATIONS_READ),
    client.from("media_items").select("id, file_id, width, height, created_at, media_sets(project_id)").eq("brand_id", brandId).eq("kind", "lifestyle").not("file_id", "is", null).order("created_at", { ascending: false }).limit(CREATIONS_READ),
  ]);
  const creations = [
    ...parsed(shootRow, shoots.data, shoots.error, "AI scenes").map(sceneOf),
    ...parsed(lifestyleRow, lifestyle.data, lifestyle.error, "lifestyle pictures").map(lifestyleOf),
  ];
  const links = await signedLinks(client, brandId, creations.map((creation) => creation.fileId));
  return creations.map((creation) => ({ ...creation, url: links.get(creation.fileId) ?? null }));
}
