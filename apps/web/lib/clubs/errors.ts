import { AppError, MESSAGES } from "@/lib/server/core/errors";

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

export const NOT_ALLOWED = "Your role in this club does not allow that.";

const CONFLICTS: Readonly<Record<string, string>> = {
  too_many_seasons: "A club can hold 20 seasons. Delete an old one first.",
  too_many_members: "A club can hold 50 members and invitations.",
  brand_limit: "You can belong to 3 clubs or brands at most.",
  owner_fixed: "The owner of a club cannot be changed or removed here.",
};

/**
 * What the club functions raise, as a failure a person may read. A missing record and another
 * club's record give the same answer, so nobody learns which exist.
 */
export const clubFailure = (error: DatabaseError, notFound: string): AppError => {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  switch (error.code) {
    case "42501":
      return new AppError("forbidden", NOT_ALLOWED);
    case "P0002":
    case "22P02":
      return new AppError("not_found", notFound);
    case "23505":
      return new AppError("conflict", "That already exists.");
    case "22023":
    case "23514":
    case "22003":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};

export const throwIfFailed = (error: DatabaseError | null, notFound: string): void => {
  if (error) throw clubFailure(error, notFound);
};
