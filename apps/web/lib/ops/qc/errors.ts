import { AppError } from "@/lib/server/core/errors";
import { opsFailure, type OpsDatabaseError } from "../errors";

/** What the part 2 ops functions refuse with, in words ops can act on. Anything else falls back to part 1's answers. */
const CONFLICTS: Readonly<Record<string, string>> = {
  not_ready_for_qc: "An order is inspected once the factory has marked it ready.",
  not_ready_to_ship: "Only an order the factory has marked ready can be shipped.",
  qc_not_passed: "The latest inspection of this order is not a pass, so it cannot ship. Inspect it again after the remake.",
  over_shipped: "That is more pieces than the order still owes.",
  not_packable: "Cartons and bags are set once the factory has the order.",
  already_packing: "A bag has been packed, so the bags cannot be remade.",
  no_such_carton: "That carton is not set up for this order. Add it first.",
  already_resolved: "That exception is already resolved.",
};

const INVALID: Readonly<Record<string, string>> = {
  remake_needed: "A failed inspection needs the pieces to make again, an owner and a due date.",
  owner_and_due_needed: "Give an owner (a name) and a due date.",
  resolution_needed: "Say how it was resolved.",
  invalid_sizes: "List the pieces by size, such as M 2, L 1.",
  invalid_checklist: "Mark all four checklist items.",
  invalid_measurements: "Each measurement needs a point, the spec, the measured value and the tolerance, in millimetres.",
  invalid_bags: "Each bag needs a size and a number of pieces.",
  invalid_kind: "That is not a kind of exception.",
};

export function qcFailure(error: OpsDatabaseError): AppError {
  const hint = error.hint ?? "";
  if (CONFLICTS[hint]) return new AppError("conflict", CONFLICTS[hint]!);
  if (INVALID[hint]) return new AppError("invalid_input", INVALID[hint]!);
  return opsFailure(error);
}

export const throwIfQcFailed = (error: OpsDatabaseError | null): void => {
  if (error) throw qcFailure(error);
};
