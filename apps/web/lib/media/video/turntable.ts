import { AppError } from "@/lib/server/core/errors";
import type { MediaFiles, MediaStore } from "../ports";
import { cleanPath } from "../paths";
import { watermark } from "../watermark";
import { attachItem } from "./attach";
import { videoPath } from "./paths";
import type { VideoFiles } from "./ports";
import { checkRecording } from "./recording";

export const TURNTABLE_PROVIDER = "browser-recorder";
export const TURNTABLE_VIEW = "three_quarter" as const;
export const SET_NOT_FINISHED = "Make the media set first, and wait for it to finish, then record the turntable.";

export interface TurntableDeps {
  readonly store: MediaStore;
  readonly files: MediaFiles;
  readonly videos: VideoFiles;
}

export type TurntableAsk = Readonly<{ brandId: string; projectId: string; setId: string; video: Uint8Array; poster: Uint8Array }>;

/**
 * Keeps a turntable recorded in the browser as the `turntable` item of a finished set. It is free (the spec renders it from the
 * 3D model, so no paid model is called) and a second recording replaces the first. The still picture is watermarked like any
 * other item; the video is served to the brand's members as it is, by `serve.ts`.
 */
export async function saveTurntable(deps: TurntableDeps, ask: TurntableAsk): Promise<{ itemId: string }> {
  const set = await deps.store.read(ask.brandId, ask.projectId, ask.setId);
  if (!set) throw new AppError("not_found", "That media set could not be found.");
  if (set.status !== "succeeded") throw new AppError("conflict", SET_NOT_FINISHED);
  const recording = await checkRecording({ video: ask.video, poster: ask.poster });

  const posterPath = cleanPath(ask.brandId, set.id, "turntable", TURNTABLE_VIEW);
  const moviePath = videoPath(ask.brandId, set.id, "turntable", TURNTABLE_VIEW);
  const fileId = await deps.files.saveWatermarked(await watermark(recording.poster));
  try {
    await deps.files.saveClean(posterPath, recording.poster);
    await deps.videos.save(moviePath, recording.video, recording.type);
    const itemId = await attachItem(deps.store, set.id, {
      kind: "turntable",
      view: TURNTABLE_VIEW,
      fileId,
      cleanPath: posterPath,
      width: recording.width,
      height: recording.height,
      checker: "not_checked",
      provider: TURNTABLE_PROVIDER,
      costMicrodollars: 0,
    });
    return { itemId };
  } catch (error) {
    await deps.files.remove({ fileIds: [fileId], cleanPaths: [posterPath] }).catch(() => undefined);
    await deps.videos.remove([moviePath]).catch(() => undefined);
    throw error;
  }
}
