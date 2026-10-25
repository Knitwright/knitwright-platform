import { AppError } from "@/lib/server/core/errors";
import type { MediaStore, NewItem } from "../ports";

export const BUSY_MESSAGE = "This media set is not ready to take more media. Wait for it to finish and try again.";

/**
 * Adds an item to a finished set. The database takes items only while a set is running (migration 20261027010000), so the
 * set is moved back to running for the moment of the write and then to succeeded again, whatever happens. The history
 * shows both moves. While it runs, the set serves watermarked pictures only, which is the safe way round.
 */
export async function attachItem(store: MediaStore, setId: string, item: NewItem): Promise<string> {
  if (!(await store.move(setId, ["succeeded"], "running"))) throw new AppError("conflict", BUSY_MESSAGE);
  try {
    return await store.putItem(setId, item);
  } finally {
    await store.move(setId, ["running"], "succeeded");
  }
}
