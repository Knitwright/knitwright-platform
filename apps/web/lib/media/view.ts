import type { MediaItem, MediaSet } from "./contract";
import type { SetRecord } from "./ports";

export type MediaItemView = MediaItem & Readonly<{ href: string | null }>;
export type MediaSetView = Omit<MediaSet, "items"> & Readonly<{ unlocked: boolean; items: readonly MediaItemView[] }>;

/** A set as the browser sees it. Never carries a clean path; the picture is asked for by `href`, and the server chooses which one to send. */
export function setView(set: SetRecord): MediaSetView {
  return {
    id: set.id,
    projectId: set.projectId,
    version: set.version,
    versionHash: set.versionHash,
    status: set.status,
    error: set.error,
    unlocked: set.unlocked,
    items: set.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      view: item.view,
      fileId: item.fileId,
      width: item.width,
      height: item.height,
      watermarked: !set.unlocked,
      checker: item.checker,
      provider: item.provider,
      costMicrodollars: item.costMicrodollars,
      href: item.fileId ? `/api/projects/${set.projectId}/media/${set.id}/items/${item.id}` : null,
    })),
  };
}
