import { draftAllSizes, toGradedPattern, type DraftInput, type DraftSources } from "@/lib/parametric";
import type { GradedPattern } from "@/lib/production/contract";
import type { PatternSource } from "../model";

/**
 * `03_patterns/**` from the graded parametric drafter (X3, decision 0068, as X3b left it), which is the seam
 * decision 0070 point 5 left open: until now the only `PatternSource` was the pattern library's synthetic run,
 * which is not a real grade.
 *
 * The drafter is read through its public API only (`draftAllSizes`, `toGradedPattern`); nothing here reaches
 * into its internals, and no number is passed to it that a caller did not ask for. An article the drafter
 * cannot draft — no script (C02 and C03's collars, every article but JSY-SS-01), no article data, no drafting
 * constants, or a value the article does not offer — comes back as a reason in words. Nothing is guessed.
 */

/**
 * The platform's own version of the drafted block, which `GradedPattern` wants as a whole number. It counts
 * changes to what the drafter produces, not the article's own `version` ("0.1"); that string travels with the
 * answer so a file can name both.
 */
export const DRAFTED_BLOCK_VERSION = 1;

export type DraftedPattern =
  | Readonly<{
      ok: true;
      /** The source `buildPackage` takes. It resolves the pattern already drafted here, so it cannot fail. */
      source: PatternSource;
      pattern: GradedPattern;
      /** The base article's own version, as `article.json` gives it. */
      articleVersion: string;
      /** The drafter's notes, such as a range no sample has signed off yet. Never a reason to stop. */
      warnings: readonly string[];
    }>
  | Readonly<{ ok: false; reason: string; ruleId: string | null }>;

/**
 * Every size of a base article as a graded pattern, or the drafter's own reason for having none. The same
 * article and input give the same pattern twice: the drafter reads no clock and no random number.
 */
export function draftedPattern(articleCode: string, input: DraftInput = {}, sources: DraftSources = {}): DraftedPattern {
  const outcome = draftAllSizes(articleCode, input, sources);
  if (outcome.kind === "not-drafted-yet") return { ok: false, reason: outcome.reason, ruleId: outcome.ruleId };
  if (outcome.kind === "invalid") {
    return { ok: false, reason: `${articleCode} cannot be drafted as asked: ${outcome.findings.map((finding) => finding.message).join(" ")}`, ruleId: outcome.findings[0]?.ruleId ?? null };
  }
  const pattern = toGradedPattern(outcome.drafts, DRAFTED_BLOCK_VERSION);
  const warnings = [...new Set(outcome.drafts.flatMap((draft) => draft.warnings.map((finding) => finding.message)))];
  return { ok: true, source: { pattern: async () => pattern }, pattern, articleVersion: outcome.article.version, warnings };
}
