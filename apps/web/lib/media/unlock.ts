import { AppError } from "@/lib/server/core/errors";
import type { MediaStore } from "./ports";

export const NOT_FINISHED_MESSAGE = "This media set is not finished yet, so it cannot be unlocked.";

/**
 * Unlocks a finished set. The caller has already spent the credits (the route is wrapped in `withCredits`, so a
 * short balance never reaches this). Safe to call twice: the second call changes nothing.
 */
export async function unlockSet(
  store: MediaStore,
  ask: Readonly<{ brandId: string; projectId: string; setId: string; userId: string }>,
): Promise<{ unlocked: true; changed: boolean }> {
  const set = await store.read(ask.brandId, ask.projectId, ask.setId);
  if (!set) throw new AppError("not_found", "That media set could not be found.");
  if (set.status !== "succeeded") throw new AppError("conflict", NOT_FINISHED_MESSAGE);
  return { unlocked: true, changed: await store.unlock(set.id, ask.userId) };
}
