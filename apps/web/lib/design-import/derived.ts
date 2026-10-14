import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtworkStack, Layer } from "@/lib/artwork-stack";
import { deleteArtwork, uploadArtwork } from "@/lib/artwork-intake";
import type { CropFile, PictureFile } from "./cuts";
import type { ImportReport } from "./report";

/**
 * Pictures cut from the person's picture (a repeating tile, a full panel, a crest) are stored as their own artwork
 * through W7b's intake, so the stack's layers name real assets the print files can read. Each is a PNG made here from
 * a picture the person said they may use, so the rights they ticked for the import go with it.
 */

/** The most crests, sponsors and badges stored from one picture. A layer past this keeps its stand-in id and is named in the report. */
export const MOST_STORED_CROPS = 8;
export const NOT_STORED = `More than ${MOST_STORED_CROPS} crests, sponsors or badges were found. The extra ones are listed but not stored, so replace them with your own files.`;

export interface DerivedStore {
  /** Stores one PNG as artwork and gives its id. */
  add(png: Uint8Array, name: string): Promise<string>;
  /** Removes artwork made here that is no longer used. Never throws: a file that cannot be removed is left for the person to delete. */
  remove(ids: readonly string[]): Promise<void>;
}

export function createDerivedStore(admin: SupabaseClient, who: { readonly brandId: string; readonly userId: string }, now: Date): DerivedStore {
  return {
    async add(png, name) {
      const record = await uploadArtwork(admin, who, { bytes: png, fileName: name, rightsConfirmed: true, now });
      return record.id;
    },
    async remove(ids) {
      await Promise.all(ids.map((id) => deleteArtwork(admin, who.brandId, id).catch(() => undefined)));
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The artwork a layer made here points at, or null (not stored, or the person's own). */
export function derivedAssetOf(layer: Layer): string | null {
  if (layer.provenance !== "read-from-image") return null;
  const id = layer.kind === "image-fill" ? layer.assetId : layer.kind === "graphic" && layer.source.kind === "asset" ? layer.source.assetId : null;
  return id !== null && UUID.test(id) ? id : null;
}

/** Ids of artwork made for these layers. */
export const derivedIds = (layers: readonly Layer[]): string[] => layers.flatMap((layer) => derivedAssetOf(layer) ?? []);

const readable = (name: string, view: string): string => `design-${name}-${view}.png`;

export interface Stored {
  readonly stack: ArtworkStack;
  readonly ids: readonly string[];
  readonly notes: readonly string[];
}

/** Stores the cut pictures and points the stack's layers at them. If one cannot be stored, the ones already stored are removed and the error is thrown. */
export async function storeDerived(stack: ArtworkStack, pictures: readonly PictureFile[], crops: readonly CropFile[], store: DerivedStore): Promise<Stored> {
  const ids = new Map<string, string>();
  const stored: string[] = [];
  const keep = crops.slice(0, MOST_STORED_CROPS);
  try {
    for (const picture of pictures) {
      const id = await store.add(picture.png, readable(picture.assetId.split("-")[0], picture.view));
      ids.set(picture.assetId, id);
      stored.push(id);
    }
    for (const crop of keep) {
      const id = await store.add(crop.png, readable("crop", `${crop.view}-${crop.assetId}`));
      ids.set(crop.assetId, id);
      stored.push(id);
    }
  } catch (error) {
    await store.remove(stored);
    throw error;
  }
  const layers = stack.layers.map((layer): Layer => {
    if (layer.kind === "image-fill") return { ...layer, assetId: ids.get(layer.assetId) ?? layer.assetId };
    if (layer.kind === "graphic" && layer.source.kind === "asset") return { ...layer, source: { kind: "asset", assetId: ids.get(layer.source.assetId) ?? layer.source.assetId } };
    return layer;
  });
  return { stack: { ...stack, layers }, ids: stored, notes: crops.length > keep.length ? [NOT_STORED] : [] };
}

/** The report with sentences added. */
export const withNotes = (report: ImportReport, notes: readonly string[]): ImportReport => (notes.length === 0 ? report : { ...report, notes: [...report.notes, ...notes] });
