import type { ReviewItem, ReviewState } from "@/lib/techpack/exports/review-gate";
import { CHECKLIST_TITLES, type ChecklistResult, type ComplianceFinding } from "./model";

/**
 * The seam to Y5's Export panel (decision 0078). `exportGate` in `lib/techpack/exports/review-gate.ts` shuts
 * the panel on a `ReviewState`, and says in its own comment that it holds "the smallest shape the gate reads
 * (Lesson 9), so the shell can hand the tab's own summary across the slot seam when both have landed".
 *
 * This is that summary. It is the whole point of there being one checklist: the sentence the Export panel
 * shows, the list the Review tab prints and the refusal the hand-off throws are three readings of one result,
 * not three checks that happen to agree today.
 *
 * Types only are imported, so nothing of the editor or the exports reaches this directory at run time.
 */

/** A finding as the Export panel's list reads it. Its path doubles as the key, so the list is stable. */
const itemOf = (found: ComplianceFinding, id: keyof typeof CHECKLIST_TITLES): ReviewItem => ({
  key: `${id}:${found.path}`,
  label: found.message,
  tab: tabOf(id),
  ruleId: found.ruleId,
});

/**
 * Which tab of the tech pack view a finding belongs to, so the panel can take the person there. A finding
 * about a label, a run or a moderation check belongs to no tab of the document: it is about the order, and
 * `null` is the shape's own word for that.
 */
function tabOf(id: keyof typeof CHECKLIST_TITLES): string | null {
  if (id === "needs_input" || id === "tbc") return "review";
  if (id === "poms") return "measurements";
  if (id === "bom") return "components";
  if (id === "labels") return "labelling";
  if (id === "colour_gamut") return "colourways";
  return null;
}

/**
 * The checklist as the Export panel's gate reads it. `reviewed` is true, because this result *is* the Review
 * tab's own report: the panel's "not reviewed yet" caution is for a version nothing has checked, and that is
 * no longer the case once a caller has a `ChecklistResult`.
 *
 * Everything the checklist calls a blocker is a blocker here, so the panel is shut for exactly the reasons the
 * Review tab lists, in the same order. The warnings are not carried across: Y5's shape has nowhere for a note
 * that does not shut the gate, and dropping them into `needsInput` would shut it over the gamut estimate,
 * which decisions 0070 and this one both refuse to do.
 */
export function reviewStateFrom(result: ChecklistResult): ReviewState {
  const needsInput = result.items
    .filter((item) => item.id === "needs_input" || item.id === "tbc")
    .flatMap((item) => item.findings.map((found) => itemOf(found, item.id)));
  const keys = new Set(needsInput.map((item) => item.key));
  const blockers = result.items.flatMap((item) =>
    item.findings.filter((found) => found.severity === "blocker").map((found) => itemOf(found, item.id)),
  );
  return { reviewed: true, needsInput, blockers: blockers.filter((item) => !keys.has(item.key)) };
}
