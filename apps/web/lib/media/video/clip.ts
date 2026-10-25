import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import type { MediaView } from "../contract";
import { cleanPath } from "../paths";
import type { ItemRecord, MediaFiles, MediaStore, SetRecord } from "../ports";
import { watermark } from "../watermark";
import { attachItem } from "./attach";
import { CLIP_SECONDS, MAX_CLIP_BYTES } from "./limits";
import { videoPath } from "./paths";
import type { VideoFiles } from "./ports";
import { CLIP_PROMPT, type VideoProvider } from "./provider";
import { sniffVideo } from "./sniff";

export const NEEDS_STILL_MESSAGE = "A clip is made from a lifestyle picture that passed the check. Make the lifestyle pictures first.";
export const CLIP_FAILED_MESSAGE = "The clip could not be made. Nothing was charged.";
const LIFESTYLE_VIEWS: readonly MediaView[] = ["on_model", "scene"];

export interface ClipDeps {
  readonly store: MediaStore;
  readonly files: MediaFiles;
  readonly videos: VideoFiles;
  readonly provider: VideoProvider;
  readonly log: (event: LogEvent) => void;
}

export type ClipAsk = Readonly<{ brandId: string; projectId: string; setId: string; view?: MediaView | undefined }>;

export type ClipPlan =
  | Readonly<{ state: "exists"; set: SetRecord; clip: ItemRecord }>
  | Readonly<{ state: "ready"; set: SetRecord; still: ItemRecord }>;

/**
 * Decides, before anything is reserved or paid, what a clip request would do: the clip is already there (nothing to pay), or
 * it can be made from a lifestyle still that passed the checker, or the request is refused in words.
 */
export async function planClip(store: MediaStore, ask: ClipAsk): Promise<ClipPlan> {
  const set = await store.read(ask.brandId, ask.projectId, ask.setId);
  if (!set) throw new AppError("not_found", "That media set could not be found.");
  if (set.status !== "succeeded") throw new AppError("conflict", "The media set is not finished yet, so a clip cannot be made from it.");
  const stills = set.items.filter((item) => item.kind === "lifestyle" && item.checker === "passed" && item.cleanPath && LIFESTYLE_VIEWS.includes(item.view) && (!ask.view || item.view === ask.view));
  const still = stills[0];
  if (!still) throw new AppError("invalid_input", NEEDS_STILL_MESSAGE);
  const clip = set.items.find((item) => item.kind === "clip" && item.view === still.view);
  return clip ? { state: "exists", set, clip } : { state: "ready", set, still };
}

/** Makes the clip and keeps it. Returns a sentence when it could not; the caller then gives the reservation back. Never throws. */
export async function makeClip(deps: ClipDeps, ask: ClipAsk, plan: Extract<ClipPlan, { state: "ready" }>, signal: AbortSignal): Promise<{ ok: true; itemId: string } | { ok: false; message: string }> {
  const { still, set } = plan;
  const poster = still.cleanPath ? await deps.files.readClean(still.cleanPath) : null;
  if (!poster) return { ok: false, message: CLIP_FAILED_MESSAGE };
  const moviePath = videoPath(ask.brandId, set.id, "clip", still.view);
  const posterPath = cleanPath(ask.brandId, set.id, "clip", still.view);
  const saved: { fileId: string | null } = { fileId: null };
  try {
    const result = await deps.provider.generate({ still: poster, seconds: CLIP_SECONDS, prompt: CLIP_PROMPT }, signal);
    if (!result.ok) return { ok: false, message: CLIP_FAILED_MESSAGE };
    if (sniffVideo(result.video) !== result.type || result.video.byteLength > MAX_CLIP_BYTES) return { ok: false, message: CLIP_FAILED_MESSAGE };
    saved.fileId = await deps.files.saveWatermarked(await watermark(poster));
    await deps.files.saveClean(posterPath, poster);
    await deps.videos.save(moviePath, result.video, result.type);
    const itemId = await attachItem(deps.store, set.id, {
      kind: "clip",
      view: still.view,
      fileId: saved.fileId,
      cleanPath: posterPath,
      width: still.width,
      height: still.height,
      checker: "not_checked",
      provider: deps.provider.name,
      costMicrodollars: deps.provider.costMicrodollars,
    });
    return { ok: true, itemId };
  } catch (error) {
    deps.log({ level: "error", message: "A clip could not be made", where: "media clip", error });
    await deps.files.remove({ fileIds: saved.fileId ? [saved.fileId] : [], cleanPaths: [posterPath] }).catch(() => undefined);
    await deps.videos.remove([moviePath]).catch(() => undefined);
    return { ok: false, message: CLIP_FAILED_MESSAGE };
  }
}
