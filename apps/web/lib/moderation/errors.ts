import { AppError, MESSAGES } from "@/lib/server/core/errors";

export type ModerationDatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

const CONFLICTS: Readonly<Record<string, string>> = {
  invalid_transition: "This item has already been decided.",
  reason_needed: "Give a reason, up to 500 characters.",
  append_only: "A moderation check can never be changed or removed.",
};

/** What the moderation functions refuse with, in words. Anyone who is not a platform admin gets "not found". */
export function moderationFailure(error: ModerationDatabaseError): AppError {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  switch (error.code) {
    case "P0002":
    case "22P02":
      return new AppError("not_found", "Not found.");
    case "22023":
    case "23505":
    case "23514":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
}
