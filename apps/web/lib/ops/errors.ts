import { AppError, MESSAGES } from "@/lib/server/core/errors";

export type OpsDatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

const CONFLICTS: Readonly<Record<string, string>> = {
  not_movable: "The factory already has this order, so it cannot be moved.",
  batch_mismatch: "A batch holds one factory, one fabric and one article. Pick a batch that matches the order.",
  not_holdable: "Only an order the factory does not have yet can be held.",
  not_held: "That order is not on hold.",
  illegal_transition: "An order moves one step at a time: in a batch, received, in production, ready.",
  not_delayable: "Only an order in a batch or at the factory can be delayed.",
  not_later: "The new promised date must be later than the current one.",
  reason_needed: "Give the reason for the delay.",
  append_only: "Ops history can never be changed or removed.",
};

export const NOT_FOUND = "That order or batch does not exist.";

/** What the ops functions raise, as a failure ops may read. Anyone who is not a platform admin gets "not found". */
export function opsFailure(error: OpsDatabaseError): AppError {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", error.hint === "reason_needed" ? CONFLICTS.reason_needed! : conflict);
  switch (error.code) {
    case "P0002":
    case "22P02":
      return new AppError("not_found", NOT_FOUND);
    case "22023":
    case "23514":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
}

export const throwIfOpsFailed = (error: OpsDatabaseError | null): void => {
  if (error) throw opsFailure(error);
};
