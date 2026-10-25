import type { MediaFiles, MediaStore } from "./ports";

export type ServedItem = Readonly<{ bytes: Uint8Array; contentType: "image/png"; watermarked: boolean }>;

/**
 * The bytes of one item. The watermarked picture is served until the set has been unlocked by spending credits;
 * the clean picture is read only for an unlocked set, so a request made before the spend has no path to it.
 * A set or item of another brand, or one that is not there, gives null.
 */
export async function serveItem(
  deps: Readonly<{ store: MediaStore; files: MediaFiles }>,
  ask: Readonly<{ brandId: string; projectId: string; setId: string; itemId: string }>,
): Promise<ServedItem | null> {
  const set = await deps.store.read(ask.brandId, ask.projectId, ask.setId);
  const item = set?.items.find((entry) => entry.id === ask.itemId);
  if (!set || !item) return null;
  if (set.unlocked && set.status === "succeeded" && item.cleanPath) {
    const bytes = await deps.files.readClean(item.cleanPath);
    return bytes ? { bytes, contentType: "image/png", watermarked: false } : null;
  }
  if (!item.fileId) return null;
  const bytes = await deps.files.readWatermarked(item.fileId);
  return bytes ? { bytes, contentType: "image/png", watermarked: true } : null;
}
