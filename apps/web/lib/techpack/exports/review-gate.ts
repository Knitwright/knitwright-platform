import { RULE_GAP } from "@/lib/validation/rules";
import type { EditorDesign } from "@/lib/editor/slots";
import { findingLines } from "@/lib/editor/validate";

/**
 * THE GATE ON EXPORT (spec F-S6: "Export is blocked until clear"; plan v5 Y5, decision 0078).
 *
 * The Review tab (Y4, `lib/techpack/view`) lists every field still "Needs your input" plus the
 * F-G2 pre-export check, and nothing may be exported while that list has anything on it. The gate
 * is a function of that list, so the Export panel cannot open it on its own and there is no way
 * round it: a panel with nothing to report still cannot declare the design clear.
 *
 * Y4 owns the Review tab. This file holds the smallest shape the gate reads (Lesson 9), so the
 * shell can hand the tab's own summary across the slot seam when both have landed.
 */

/** One thing somebody still has to do before this version can be sent to a factory. */
export interface ReviewItem {
  readonly key: string;
  readonly label: string;
  /** Which tab of the tech pack view it is on, or null for the whole design. */
  readonly tab: string | null;
  readonly ruleId: string;
}

export interface ReviewState {
  /**
   * True once the Review tab itself has reported on this version. False means only the editor's
   * own findings are known, and the panel says so rather than claiming the design is clear.
   */
  readonly reviewed: boolean;
  /** Fields still "Needs your input", from the Review tab. */
  readonly needsInput: readonly ReviewItem[];
  /** Findings that stop the design going out at all, such as a value the article does not offer. */
  readonly blockers: readonly ReviewItem[];
}

export interface ExportGate {
  /** True when a file may be built. */
  readonly open: boolean;
  /** Why it is shut, in one plain sentence, or null when it is open. */
  readonly reason: string | null;
  /** What has to be done first, in the order the person should work through it. */
  readonly items: readonly ReviewItem[];
  /**
   * Said whether the gate is open or shut, when the Review tab has not reported yet: these files
   * carry whatever the tech pack carries, gaps and all.
   */
  readonly caution: string | null;
}

const BLOCKED_BY_FINDINGS = "Fix what the Validate chip lists before you export: these files would carry a design the platform cannot build.";
const BLOCKED_BY_REVIEW = "The Review tab still asks for something. Export is blocked until that list is clear.";
const NOT_REVIEWED = "The Review tab has not checked this version yet, so these files carry whatever the tech pack carries, including anything still to be confirmed.";

/** The gate, from what the Review tab says. Nothing else can open it. */
export function exportGate(review: ReviewState): ExportGate {
  const caution = review.reviewed ? null : NOT_REVIEWED;
  if (review.blockers.length > 0) return { open: false, reason: BLOCKED_BY_FINDINGS, items: [...review.blockers, ...review.needsInput], caution };
  if (review.needsInput.length > 0) return { open: false, reason: BLOCKED_BY_REVIEW, items: review.needsInput, caution };
  return { open: true, reason: null, items: [], caution };
}

/**
 * What the editor itself knows about this version: the drafter's findings about the form, and the
 * options and ranges no golden sample has signed off. It reports no "Needs your input", because
 * the slot contract hands a panel the design and not the tech pack, so `reviewed` stays false and
 * the panel says plainly that the Review tab is the list that counts.
 */
export function reviewFromDesign(design: Pick<EditorDesign, "draft" | "article" | "form">): ReviewState {
  const lines = findingLines({ checks: [], draft: design.draft, article: design.article, form: design.form });
  const item = (line: (typeof lines)[number]): ReviewItem => ({
    key: line.key,
    label: line.message,
    tab: line.target,
    ruleId: line.ruleId === "" ? RULE_GAP : line.ruleId,
  });
  return { reviewed: false, needsInput: [], blockers: lines.filter((line) => line.severity === "blocker").map(item) };
}
