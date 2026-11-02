import { baseArticleForType } from "@/lib/catalogue";
import { SEEDED_NOT_DRAFTED, needsBeforeDrafting, type NotDraftedSource } from "@/lib/parametric/articles";

/**
 * What a template's own base article has no data for, so a card can say it rather than look ready
 * (plan v5 L8, decision 0098).
 *
 * Nothing is judged or invented here. The one source is the register of decision 0090
 * (`lib/parametric/articles`), which is read from each article's own brief: seven of the eight launch
 * articles publish no point of measure and no block, so nothing can be drafted from them and no
 * measurement may be filled in. Each gap carries the rulebook entry its brief names, never a rule
 * written here, and an article the register does not list has no gap to report.
 */

/** One thing an article has no data for, in words a card can show, with the rule that explains it. */
export interface ArticleGap {
  /** `R-<TOPIC>-<NNN>`, from the article's own rulebook. */
  readonly ruleId: string;
  /** One short line for a card. */
  readonly line: string;
  /** What a factory would have to supply, in the brief's own words. */
  readonly needs: readonly string[];
}

/** The words a card shows when the article behind a template has no measurement on file. */
export const NO_MEASUREMENT_LINE = "No measurement on file for this garment yet";

/**
 * The gap of one base article, or null when the register lists none for it. `JSY-SS-01` is the one
 * launch article with a factory-shaped brief and a drafting script, so it answers null.
 */
export function gapForArticle(code: string, source: NotDraftedSource = SEEDED_NOT_DRAFTED): ArticleGap | null {
  const entry = source.get(code);
  if (entry === null) return null;
  return { ruleId: entry.rule, line: NO_MEASUREMENT_LINE, needs: needsBeforeDrafting(code, source) };
}

/**
 * The gap behind a design template, found from the garment type it is drawn on. A garment type the
 * catalogue maps to no base article has no gap to report here: validation raises that on its own as
 * a warning (decision 0069), and this file never states a fact about an article it cannot name.
 */
export function gapForType(typeId: string, source: NotDraftedSource = SEEDED_NOT_DRAFTED): ArticleGap | null {
  const code = baseArticleForType(typeId);
  return code === undefined ? null : gapForArticle(code, source);
}

/** True when a card must carry a gap line instead of looking ready. */
export const hasGap = (typeId: string, source: NotDraftedSource = SEEDED_NOT_DRAFTED): boolean => gapForType(typeId, source) !== null;
