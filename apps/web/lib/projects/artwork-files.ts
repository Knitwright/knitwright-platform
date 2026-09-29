import type { SupabaseClient } from "@supabase/supabase-js";
import type { Artwork, Dropped, GarmentSpec, SpecAction } from "@/lib/garment";
import { NO_SUCH_FILE } from "@/lib/storage/links";
import type { ReadSpec } from "./project-reads";

/**
 * Artwork that refers to a stored picture must refer to a picture of the brand the person
 * is working in. This is checked with the person's own client, so the database's rules
 * decide as well as this code. Every path that stores a design passes through it.
 */

const fileIdOf = (art: Artwork): string[] => (art.source.kind === "file" ? [art.source.fileId] : []);

/** The stored pictures a change would point artwork at. Only adding or updating artwork can. */
export const filesInAction = (action: SpecAction): string[] =>
  action.type === "add-artwork" || action.type === "update-artwork" ? fileIdOf(action.artwork) : [];

/** Which of these ids the brand cannot read as an artwork file: missing, another brand's, or another kind. */
export async function unreadableFileIds(client: SupabaseClient, brandId: string, ids: readonly string[]): Promise<Set<string>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return new Set();
  const { data, error } = await client.from("files").select("id").eq("brand_id", brandId).eq("kind", "artwork").in("id", wanted);
  if (error) throw new Error("The files could not be checked.", { cause: error });
  const readable = new Set((data ?? []).map((row: { id: string }) => row.id));
  return new Set(wanted.filter((id) => !readable.has(id)));
}

/** The sentence to refuse a change with, or null when every picture it names is the brand's. */
export async function refuseUnreadableArtwork(client: SupabaseClient, brandId: string, action: SpecAction): Promise<string | null> {
  const missing = await unreadableFileIds(client, brandId, filesInAction(action));
  return missing.size > 0 ? NO_SUCH_FILE : null;
}

/** A design with artwork removed whose picture the brand cannot read, and one sentence for each removal. */
export async function dropUnreadableArtwork(client: SupabaseClient, brandId: string, read: ReadSpec): Promise<ReadSpec> {
  const missing = await unreadableFileIds(client, brandId, read.spec.artwork.flatMap(fileIdOf));
  if (missing.size === 0) return read;
  const gone = read.spec.artwork.filter((art) => fileIdOf(art).some((id) => missing.has(id)));
  const spec: GarmentSpec = { ...read.spec, artwork: read.spec.artwork.filter((art) => !gone.includes(art)) };
  const dropped: Dropped[] = gone.map((art) => ({
    kind: "artwork",
    id: art.id,
    message: `${art.name} was removed, because its picture could not be found.`,
  }));
  return { spec, dropped: [...read.dropped, ...dropped] };
}
