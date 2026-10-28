import type { LogEvent } from "@/lib/server/core/guard";
import type { GeneratedMedia, GenerateRequest, MediaGenerator } from "./contract";
import { cleanPath } from "./paths";
import type { MediaFiles, MediaStore } from "./ports";
import { watermark } from "./watermark";

/**
 * The work of one media set, run after the response. Each picture is watermarked and stored, and its clean
 * original is kept privately. It never throws: nothing is waiting for it. A set that cannot be finished is marked
 * failed with a sentence safe to show, and what it had stored is removed again. Nothing was charged yet, so there is
 * nothing to give back: credits are spent only when the set is unlocked.
 */

export const FAILED_MESSAGE = "The media could not be made. Nothing was charged. Try again.";
const TIME_LIMIT_MS = 50_000;

interface GenerateDeps {
  readonly store: MediaStore;
  readonly files: MediaFiles;
  readonly generators: readonly MediaGenerator[];
  readonly log: (event: LogEvent) => void;
  readonly timeoutMs?: number;
}

type SetWork = Readonly<{ setId: string; brandId: string; request: GenerateRequest }>;

const WHERE = "media set";

async function keep(deps: GenerateDeps, work: SetWork, media: GeneratedMedia, kept: { fileIds: string[]; cleanPaths: string[] }): Promise<void> {
  const marked = await watermark(media.png);
  const fileId = await deps.files.saveWatermarked(marked);
  kept.fileIds.push(fileId);
  const path = cleanPath(work.brandId, work.setId, media.kind, media.view);
  await deps.files.saveClean(path, media.png);
  kept.cleanPaths.push(path);
  await deps.store.putItem(work.setId, {
    kind: media.kind,
    view: media.view,
    fileId,
    cleanPath: path,
    width: media.width,
    height: media.height,
    checker: media.checker,
    provider: media.provider,
    costMicrodollars: media.costMicrodollars,
  });
}

async function make(deps: GenerateDeps, work: SetWork, kept: { fileIds: string[]; cleanPaths: string[] }): Promise<string | null> {
  const signal = AbortSignal.timeout(deps.timeoutMs ?? TIME_LIMIT_MS);
  for (const generator of deps.generators) {
    const result = await generator.generate(work.request, signal);
    if (!result.ok) return result.message;
    for (const media of result.media) await keep(deps, work, media, kept);
  }
  return null;
}

export async function runMediaSet(deps: GenerateDeps, work: SetWork): Promise<"succeeded" | "failed"> {
  const kept = { fileIds: [] as string[], cleanPaths: [] as string[] };
  const fail = async (message: string): Promise<"failed"> => {
    try {
      await deps.files.remove(kept);
    } catch (error) {
      deps.log({ level: "error", message: "The pictures of a failed media set could not be removed", where: WHERE, error });
    }
    try {
      await deps.store.move(work.setId, ["queued", "running"], "failed", message);
    } catch (error) {
      deps.log({ level: "error", message: "A failed media set could not be marked failed", where: WHERE, error });
    }
    return "failed";
  };
  try {
    if (!(await deps.store.move(work.setId, ["queued"], "running"))) return "failed";
    const refused = await make(deps, work, kept);
    if (refused !== null) return await fail(refused);
    if (!(await deps.store.move(work.setId, ["running"], "succeeded"))) return await fail(FAILED_MESSAGE);
    return "succeeded";
  } catch (error) {
    deps.log({ level: "error", message: "A media set failed", where: WHERE, error });
    return fail(FAILED_MESSAGE);
  }
}
