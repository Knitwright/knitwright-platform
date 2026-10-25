import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { EDIT_WINDOW_MINUTES } from "./limits";

export type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

export const COMMENT_NOT_FOUND = "That comment does not exist.";
export const DESIGN_NOT_FOUND = "That design does not exist.";

const BY_HINT: Readonly<Record<string, () => AppError>> = {
  rate_limited: () => new AppError("rate_limited", "You are commenting very quickly. Wait a few minutes."),
  too_many_comments: () => new AppError("conflict", "This design or thread has as many comments as it can hold."),
  edit_window_closed: () => new AppError("forbidden", `A comment can be changed or removed for ${EDIT_WINDOW_MINUTES} minutes after it is written.`),
  mention_not_member: () => new AppError("invalid_input", "Only members of this brand can be named."),
  too_many_mentions: () => new AppError("invalid_input", "A comment can name 10 people at most."),
};

/**
 * What the comment functions raise, as a failure a person may read. A missing record and another
 * brand's record give the same answer, so nobody learns which exist. Database text is never shown.
 */
export function commentFailure(error: DatabaseError, notFound: string): AppError {
  const byHint = error.hint ? BY_HINT[error.hint] : undefined;
  if (byHint) return byHint();
  switch (error.code) {
    case "42501":
      return new AppError("forbidden", "Your role in this brand does not allow that.");
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
}

export function throwIfFailed(error: DatabaseError | null, notFound: string): void {
  if (error) throw commentFailure(error, notFound);
}
