import { AppError, MESSAGES } from "@/lib/server/core/errors";

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

const CONFLICTS: Readonly<Record<string, string>> = {
  too_many_orders: "This design has as many team orders as it can hold. Delete one first.",
  too_many_releases: "This design has as many releases as it can hold.",
  too_many_strike_offs: "This release has as many strike-offs as it can hold.",
  not_received: "Record that the strike-off has arrived before anyone accepts or rejects it.",
  append_only: "That record has been decided and can no longer be changed.",
};

/**
 * What the production functions raise, as a failure the user may read. A missing record and
 * another brand's record give the same answer, so nobody learns which exist. Unknown faults say
 * nothing more than that something went wrong.
 */
export const productionFailure = (error: DatabaseError, notFound: string): AppError => {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  switch (error.code) {
    case "P0002":
    case "22P02":
      return new AppError("not_found", notFound);
    case "22023":
    case "23514":
    case "22003":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};

export const throwIfFailed = (error: DatabaseError | null, notFound: string): void => {
  if (error) throw productionFailure(error, notFound);
};
