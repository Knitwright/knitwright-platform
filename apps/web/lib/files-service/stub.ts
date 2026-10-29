import type { Answered, Failure, FilesService, HealthAnswer } from "./contract";
import { ENGINE_NOTES, type FilesServiceOperation } from "./operations";

/**
 * The files service while it does not exist (plan v5, owner decision 2). Every call answers
 * "not available" in words a member can read, and names what the operation will do, so a screen
 * can say why a button is off instead of failing silently.
 */

export const NOT_AVAILABLE = "The Knitwright files service is not available yet.";

/** The sentence a screen shows for one operation. */
export const notAvailableMessage = (operation: FilesServiceOperation): string =>
  `${NOT_AVAILABLE} It will do this: ${ENGINE_NOTES[operation].engine}.`;

const failure = (message: string): Failure => ({ ok: false, failure: "not_available", message });

export function createStubFilesService(): FilesService {
  return {
    name: "files-service-stub",
    health: async (): Promise<Answered<HealthAnswer>> => failure(NOT_AVAILABLE),
    call: async (operation) => failure(notAvailableMessage(operation)),
  };
}
