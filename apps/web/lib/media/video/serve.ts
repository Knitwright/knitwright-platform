import type { MediaStore } from "../ports";
import { videoPath } from "./paths";
import type { VideoFiles } from "./ports";
import { sniffVideo, type VideoType } from "./sniff";

export const CLIP_LOCKED_MESSAGE = "The clip is available once credits are spent on this media set. Until then only the preview picture is shown.";

export type ServedVideo =
  | Readonly<{ state: "ok"; bytes: Uint8Array; contentType: VideoType; aiGenerated: boolean }>
  | Readonly<{ state: "locked" }>
  | Readonly<{ state: "missing" }>;

/**
 * The bytes of a video item. A turntable is free, so a member of the brand gets it as soon as it is saved. A clip is the paid
 * output: its file is read from storage only when the set is unlocked and finished. Before that the answer is "locked" and
 * storage is never asked, so the file has no path to the browser. A set or item of another brand is "missing".
 */
export async function serveVideo(
  deps: Readonly<{ store: MediaStore; videos: VideoFiles }>,
  ask: Readonly<{ brandId: string; projectId: string; setId: string; itemId: string }>,
): Promise<ServedVideo> {
  const set = await deps.store.read(ask.brandId, ask.projectId, ask.setId);
  const item = set?.items.find((entry) => entry.id === ask.itemId);
  if (!set || !item || (item.kind !== "clip" && item.kind !== "turntable")) return { state: "missing" };
  if (item.kind === "clip" && !(set.unlocked && set.status === "succeeded")) return { state: "locked" };
  const bytes = await deps.videos.read(videoPath(ask.brandId, set.id, item.kind, item.view));
  const contentType = bytes ? sniffVideo(bytes) : null;
  return bytes && contentType ? { state: "ok", bytes, contentType, aiGenerated: item.kind === "clip" } : { state: "missing" };
}
