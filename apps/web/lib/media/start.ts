import { AppError } from "@/lib/server/core/errors";
import type { GenerateRequest } from "./contract";
import type { MediaStore, SetRecord } from "./ports";
import { mediaVersionHash } from "./version";

export const NO_DRAWING_MESSAGE = "There is no drawing of this garment to make media from yet.";

interface StartDeps {
  readonly store: MediaStore;
  /** The saved version media is made from, or null when the design has no drawing. */
  readonly loadVersion: (asked?: number) => Promise<Readonly<{ version: number }> | null>;
  readonly schedule: (work: () => Promise<unknown>) => void;
  readonly run: (work: Readonly<{ setId: string; request: GenerateRequest }>) => Promise<unknown>;
}

type StartInput = Readonly<{ brandId: string; projectId: string; userId: string; version?: number }>;

/**
 * Starts the media set of a design version, once. A second request for the same version gets the set that
 * exists, and no second job is started. A set that failed is started again.
 */
export async function startMediaSet(deps: StartDeps, input: StartInput): Promise<{ set: SetRecord; created: boolean }> {
  const loaded = await deps.loadVersion(input.version);
  if (!loaded) throw new AppError("invalid_input", NO_DRAWING_MESSAGE);
  const started = await deps.store.start({
    brandId: input.brandId,
    projectId: input.projectId,
    userId: input.userId,
    version: loaded.version,
    versionHash: mediaVersionHash(input.projectId, loaded.version),
  });
  if (started.created) {
    const request: GenerateRequest = { design: { projectId: input.projectId, version: loaded.version } };
    deps.schedule(() => deps.run({ setId: started.id, request }));
  }
  const set = await deps.store.read(input.brandId, input.projectId, started.id);
  if (!set) throw new AppError("not_found", "That media set could not be found.");
  return { set, created: started.created };
}
