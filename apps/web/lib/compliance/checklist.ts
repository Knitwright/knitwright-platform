import { ITEM_CHECKS } from "./items";
import {
  CHECKLIST_TITLES,
  type ChecklistItemId,
  type ChecklistItemResult,
  type ChecklistResult,
  type ComplianceFinding,
} from "./model";
import type { PreExportSubject } from "./subject";

/**
 * The one F-G2 pre-export checklist (plan v5 Z8, decision 0089). The tech pack Review tab, the production
 * package and ordering all call this function, over the one subject shape, and read the one `clear` field.
 * There is no second copy of any item: before this, the package had its own gate and ordering had its own
 * findings, and the two could disagree about whether the same design was ready.
 *
 * It is deterministic: the same subject gives the same items, the same findings and the same order.
 */

export function preExportCheck(subject: PreExportSubject): ChecklistResult {
  const items: ChecklistItemResult[] = ITEM_CHECKS.map((check) => {
    const skipped = check.skip(subject);
    if (skipped !== null) {
      return { id: check.id, title: CHECKLIST_TITLES[check.id], status: "skipped", skipped, findings: [] };
    }
    const findings = check.run(subject);
    const status = findings.some((found) => found.severity === "blocker") ? "fail" : findings.length > 0 ? "warn" : "pass";
    return { id: check.id, title: CHECKLIST_TITLES[check.id], status, skipped: null, findings };
  });
  const findings = items.flatMap((item) => item.findings);
  const blockers = findings.filter((found) => found.severity === "blocker");
  return {
    source: subject.source,
    items,
    blockers,
    warnings: findings.filter((found) => found.severity === "warning"),
    clear: blockers.length === 0,
  };
}

/** One item by its id, for a screen that shows a single row. */
export const itemOf = (result: ChecklistResult, id: ChecklistItemId): ChecklistItemResult | null =>
  result.items.find((item) => item.id === id) ?? null;

/**
 * One sentence for the top of the Review tab, the package README and the order button's tooltip. It never
 * says "ready": a checklist with nothing against it still has items nobody checked, and the sentence says so.
 */
export function checklistSentence(result: ChecklistResult): string {
  const failed = result.items.filter((item) => item.status === "fail");
  if (failed.length > 0) {
    const count = result.blockers.length;
    return `${count} ${count === 1 ? "thing" : "things"} to put right before this can go to a factory.`;
  }
  const skipped = result.items.filter((item) => item.status === "skipped").length;
  const warnings = result.warnings.length;
  const notes = warnings === 0 ? "" : ` ${warnings} ${warnings === 1 ? "note goes" : "notes go"} with it.`;
  return skipped === 0
    ? `Every check passed.${notes}`
    : `Every check that applies passed; ${skipped} ${skipped === 1 ? "was" : "were"} not checked here.${notes}`;
}

/** Every rule id the result names, once each, sorted. What a PR comment and a "Why?" popover list. */
export const ruleIdsOf = (result: ChecklistResult): readonly string[] =>
  [...new Set([...result.blockers, ...result.warnings].map((found) => found.ruleId))].sort();

/** The refusal a caller throws or shows: the first blocker's words, or null when nothing blocks. */
export const whyNotClear = (result: ChecklistResult): string | null => result.blockers[0]?.message ?? null;

/** Every finding, blockers first, for a list a person reads top to bottom. */
export const findingsOf = (result: ChecklistResult): readonly ComplianceFinding[] => [...result.blockers, ...result.warnings];
