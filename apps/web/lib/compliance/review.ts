import { AppError } from "@/lib/server/core/errors";
import { preExportCheck, whyNotClear } from "./checklist";
import { classBReviewFinding, requiresHumanReview } from "./items";
import type { ChecklistResult, ComplianceFinding } from "./model";
import type { PreExportSubject } from "./subject";

/**
 * The gate before a run is handed off to a factory (plan v5 Z8; F-G1 "human review before any Class B run",
 * F-G2 "a deterministic checklist before export or order").
 *
 * Two different things are easy to confuse here, so both are named:
 *
 * * **The Class B human review is a block.** F-G1 asks for a person to look at the design before any Class B
 *   run, and a person either has or has not. `classBReviewFinding` refuses until one has, and
 *   `assertHandOffAllowed` throws. X8 holds the same rule in `assertHumanReviewed`, against the store; this
 *   one is the checklist's copy, over an already-read `humanAllowed`, so the Review tab can show it before
 *   anyone presses anything.
 * * **The Class B 50 to 300 piece range is a flag, not a refusal.** It is not in this file, and nothing here
 *   looks at a quantity. Refusing a run of 400 pieces would assert that a factory will not make 400 of a
 *   style, which no factory has confirmed; the brand-run builder of decision 0062 flags it instead.
 *   `lib/make/run.ts` and `public.submit_make_order` own that rule.
 */

/** The Class B review rule itself lives beside the checklist item that runs it. */
export { classBReviewFinding, requiresHumanReview };

export type HandOffGate =
  | Readonly<{ status: "ready"; result: ChecklistResult; notes: readonly ComplianceFinding[] }>
  | Readonly<{ status: "blocked"; result: ChecklistResult; why: string; findings: readonly ComplianceFinding[] }>;

/**
 * Whether a run may be handed off, and every reason it may not. The whole F-G2 checklist is the gate, not
 * only the human review: a package that may not be built is a run that may not be cut.
 */
export function handOffGate(subject: PreExportSubject): HandOffGate {
  const result = preExportCheck(subject);
  if (result.clear) return { status: "ready", result, notes: result.warnings };
  return { status: "blocked", result, why: whyNotClear(result) ?? "", findings: result.blockers };
}

/** What the "Hand this run to the factory" button says when it is off, or null when it is on. */
export const whyNoHandOff = (gate: HandOffGate): string | null => (gate.status === "blocked" ? gate.why : null);

/**
 * The guard the hand-off itself calls. It throws rather than returning, so a caller cannot forget to look:
 * the screen reads `handOffGate`, and this is the second check, at the act.
 */
export function assertHandOffAllowed(subject: PreExportSubject): void {
  const gate = handOffGate(subject);
  if (gate.status === "blocked") throw new AppError("conflict", gate.why);
}
