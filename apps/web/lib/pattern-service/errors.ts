import { AppError } from "@/lib/server/core/errors";
import { opsFailure, type OpsDatabaseError } from "@/lib/ops/errors";

const CONFLICTS: Readonly<Record<string, string>> = {
  invalid_transition: "A request moves one step at a time: requested, accepted, being drafted, delivered. Files are attached while it is being drafted.",
  reason_needed: "Say why the request is declined.",
  files_needed: "Attach the pattern files before delivering.",
};

const INVALID: Readonly<Record<string, string>> = {
  invalid_input: "Those files are not pattern files of this brand, or there are too many. Attach 1 to 10 DXF files.",
};

/** What the pattern request functions refuse with, in words. Anything else falls back to the ops answers. */
export function patternFailure(error: OpsDatabaseError): AppError {
  const hint = error.hint ?? "";
  if (CONFLICTS[hint]) return new AppError("conflict", CONFLICTS[hint]!);
  if (INVALID[hint]) return new AppError("invalid_input", INVALID[hint]!);
  if (error.code === "P0002") return new AppError("not_found", "That design or request does not exist.");
  return opsFailure(error);
}

export const throwIfPatternFailed = (error: OpsDatabaseError | null): void => {
  if (error) throw patternFailure(error);
};
