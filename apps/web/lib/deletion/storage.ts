import type { DeletionClient, StoredObject } from "./client";

/**
 * Removing stored objects. Supabase lets only its storage API remove them, so the database
 * functions say what to remove and this code removes it.
 */

/** Every bucket that holds brand files. Each path starts with the brand's id. */
export const BUCKETS = ["uploads", "images", "exports"] as const;

/** The most paths sent in one remove call. */
export const REMOVE_BATCH = 100;

const PAGE = 1000;

/** Paths are "<brand id>/<kind>/<file>", so a brand folder is never deeper than this. */
const MAX_DEPTH = 3;

const BRAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

const byBucket = (objects: readonly StoredObject[]): Map<string, string[]> => {
  const grouped = new Map<string, string[]>();
  for (const { bucket, path } of objects) grouped.set(bucket, [...(grouped.get(bucket) ?? []), path]);
  return grouped;
};

/** Removes these objects. Throws if storage refuses, so the caller stops before the rows go. */
export const removeObjects = async (
  client: DeletionClient,
  objects: readonly StoredObject[],
): Promise<void> => {
  for (const [bucket, paths] of byBucket(objects)) {
    for (const batch of chunks(paths, REMOVE_BATCH)) {
      const { error } = await client.storage.from(bucket).remove(batch);
      if (error) throw new Error("The stored files could not be removed.", { cause: error });
    }
  }
};

/** Every object path under a folder, however deep, within the brand folder layout. */
const pathsUnder = async (
  client: DeletionClient,
  bucket: string,
  prefix: string,
  depth: number,
): Promise<string[]> => {
  const found: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error("The stored files could not be listed.", { cause: error });
    const entries = data ?? [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id !== null) found.push(path);
      else if (depth < MAX_DEPTH) found.push(...(await pathsUnder(client, bucket, path, depth + 1)));
    }
    if (entries.length < PAGE) return found;
  }
};

/**
 * Removes everything in these brands' folders, in every bucket, including any object that has no
 * row. Used when a whole brand goes. Returns how many objects were removed.
 */
export const emptyBrandFolders = async (
  client: DeletionClient,
  brandIds: readonly string[],
): Promise<number> => {
  // A listing prefix comes only from an id, so it can never name another brand's folder.
  for (const id of brandIds) {
    if (!BRAND_ID.test(id)) throw new Error(`"${id}" is not a brand id.`);
  }
  let removed = 0;
  for (const brandId of brandIds) {
    for (const bucket of BUCKETS) {
      const paths = await pathsUnder(client, bucket, brandId, 2);
      await removeObjects(client, paths.map((path) => ({ bucket, path })));
      removed += paths.length;
    }
  }
  return removed;
};
