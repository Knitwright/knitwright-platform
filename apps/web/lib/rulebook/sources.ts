import type { RuleSource, RulebookEntry } from "./constants";

/**
 * Who actually said a rule (owner decision 13). The source note stays word for word as the rulebook wrote it;
 * this is only the kind it is filed under. Misfiling implies a sign-off nobody gave, so:
 *
 *  * a note that only ASKS the factory for something ("Factory to confirm their RIP settings", "Factory to
 *    measure") is not the factory's word. It is Knitwright's own draft, waiting for the factory;
 *  * a supplier's price list is the supplier's word, not the factory's;
 *  * `pattern_master` means a real master pattern artifact, and owner decision 10 says none exists yet, so
 *    nothing is filed under it;
 *  * everything else the rulebook names (industry standards, process physics, regulation, AQL practice) is a
 *    standard.
 *
 * `markdown.ts` keeps `sourceFromNote`, the reading the first seed used, so the first migration can still be
 * checked against the rulebook. This is the reading in force.
 */

const trimmed = (note: string): string => note.trim();

/** "Factory to confirm...", "Factory to measure": a request, not a statement. */
export const asksTheFactory = (note: string): boolean => /^factory to\b/i.test(trimmed(note));

/** "Supplier price lists, May 2026": a supplier said it. */
export const isSupplierList = (note: string): boolean => /^supplier\b/i.test(trimmed(note));

/** The kind a source note belongs under. */
export function sourceOf(note: string): RuleSource {
  const text = trimmed(note);
  if (/^knitwright\b/i.test(text)) return "knitwright";
  if (isSupplierList(text)) return "supplier";
  if (asksTheFactory(text)) return "knitwright";
  if (/^factory\b/i.test(text) || /price list/i.test(text)) return "factory";
  return "standard";
}

type Filed = Pick<RulebookEntry, "source" | "sourceNote">;

/**
 * A rule filed as `factory` that the factory did not say: no note at all, a note that only asks them, or a note
 * that names somebody else. Nothing in the rulebook may be filed this way.
 */
export const misfiledAsFactory = (rule: Filed): boolean =>
  rule.source === "factory" && (trimmed(rule.sourceNote) === "" || asksTheFactory(rule.sourceNote) || isSupplierList(rule.sourceNote));
