import { AppError, MESSAGES } from "@/lib/server/core/errors";

export const CONFLICT_MESSAGE = "This design was changed somewhere else. Reload to see the latest version.";
export const NOT_FOUND_MESSAGE = "That design does not exist.";

export type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

/**
 * Turns what the project functions raise into a failure the user may read. A design
 * that is missing, one that belongs to another brand and an id that is not an id all
 * give the same answer, so nobody learns which designs exist.
 */
export const failureFromDatabase = (error: DatabaseError): AppError => {
  if (error.hint === "version_conflict") return new AppError("conflict", CONFLICT_MESSAGE);
  switch (error.code) {
    case "28000": // The function found no signed-in user.
    case "42501": // The caller may not run the function at all.
      return new AppError("unauthenticated", MESSAGES.unauthenticated);
    case "22023": // A value the function refuses. The app checks these first.
      return new AppError("invalid_input", MESSAGES.invalid_input);
    case "P0002": // No such design, or not the caller's.
    case "22P02": // The id is not an id.
      return new AppError("not_found", NOT_FOUND_MESSAGE);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};
