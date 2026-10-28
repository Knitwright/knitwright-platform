import { AppError, MESSAGES } from "@/lib/server/core/errors";

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

export const NOT_ALLOWED = "Your role in this brand does not allow that.";

const CONFLICTS: Readonly<Record<string, string>> = {
  too_many_products: "A brand can list 200 products.",
  stage_blocks: "This product is not at the right stage for that order.",
  stage_move: "A product moves forward one stage at a time.",
  need_sample_order: "Order a sample before moving to the sample stage.",
  request_key_conflict: "That order was already sent for another product. Reload the page and try again.",
  external_ref_conflict: "That order was already sent. Reload the page and try again.",
};

const INVALID: Readonly<Record<string, string>> = {
  invalid_sizes: "Each size needs a whole number of pieces; a sample is one piece of each size.",
  invalid_input: "The order needs a factory and a fabric of up to 120 characters each.",
};

/**
 * What the brand run functions raise (and the ops function they call), as a failure a person may read. A missing record and
 * another brand's record give the same answer, so nobody learns which exist.
 */
export function brandRunFailure(error: DatabaseError, notFound: string): AppError {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  const invalid = error.hint ? INVALID[error.hint] : undefined;
  if (invalid) return new AppError("invalid_input", invalid);
  switch (error.code) {
    case "42501":
      return new AppError("forbidden", NOT_ALLOWED);
    case "P0002":
    case "22P02":
      return new AppError("not_found", notFound);
    case "23505":
      return new AppError("conflict", "That product is already in the list.");
    case "22023":
    case "23514":
    case "22003":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
}

export const throwIfFailed = (error: DatabaseError | null, notFound: string): void => {
  if (error) throw brandRunFailure(error, notFound);
};
