import {
  NO_PROJECT_MESSAGE,
  NO_VIEW_MESSAGE,
  RECORD_FAILED_MESSAGE,
  SAVED_LABEL,
  SAVE_FAILED_MESSAGE,
  TOO_BIG_MESSAGE,
  UNSUPPORTED_MESSAGE,
} from "@/lib/media/video/copy";
import type { MediaSetView } from "@/lib/media/view";
import type { RecordResult } from "../video/record";

/**
 * "Record turntable" for the media screen. It uses the recorder and the sentences of the 3D view's own control
 * (components/media/video, decision 0058) but knows the set already, so it can show the saved turntable at once.
 * The browser pieces are passed in, so the order of the steps is tested without a browser.
 */

export type TurntableDeps = Readonly<{
  findCanvas: () => HTMLCanvasElement | null;
  canRecord: () => boolean;
  record: (canvas: HTMLCanvasElement) => Promise<RecordResult>;
  upload: (video: Blob, poster: Blob) => Promise<boolean>;
  reload: () => Promise<MediaSetView | null>;
}>;

type TurntableOutcome = Readonly<{ message: string; tone: "ok" | "warn"; set: MediaSetView | null }>;

const warn = (message: string): TurntableOutcome => ({ message, tone: "warn", set: null });

const REASONS = { unsupported: UNSUPPORTED_MESSAGE, too_large: TOO_BIG_MESSAGE, failed: RECORD_FAILED_MESSAGE } as const;

export async function recordTurntable(deps: TurntableDeps, options: Readonly<{ projectMissing?: boolean }> = {}): Promise<TurntableOutcome> {
  if (options.projectMissing) return warn(NO_PROJECT_MESSAGE);
  const canvas = deps.findCanvas();
  if (!canvas) return warn(NO_VIEW_MESSAGE);
  if (!deps.canRecord()) return warn(UNSUPPORTED_MESSAGE);
  try {
    const result = await deps.record(canvas);
    if (!result.ok) return warn(REASONS[result.reason]);
    if (!(await deps.upload(result.recording.video, result.recording.poster))) return warn(SAVE_FAILED_MESSAGE);
    return { message: SAVED_LABEL, tone: "ok", set: await deps.reload() };
  } catch {
    return warn(RECORD_FAILED_MESSAGE);
  }
}
