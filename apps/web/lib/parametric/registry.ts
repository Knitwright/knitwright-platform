import { BUNDLED_ARTICLES, type ArticleDefinition, type ArticleSource } from "./article";
import { SEEDED_DRAFT_CONSTANTS, type DraftConstantsSource } from "./constants";
import { JSY_SS_01 } from "./jsy-ss-01";
import { resolveInput } from "./params";
import type { ArticleScript } from "./script";
import { NOT_DRAFTED_YET, type ArticleDraft, type DraftInput, type DraftOutcome } from "./types";

/** Every article with a drafting script. An article not listed here is "not drafted yet". */
export const ARTICLE_SCRIPTS: readonly ArticleScript[] = [JSY_SS_01];

export const scriptFor = (code: string): ArticleScript | null => ARTICLE_SCRIPTS.find((s) => s.code === code) ?? null;

/** Where the drafter reads an article and the constants it is drawn with. */
export type DraftSources = Readonly<{ articles?: ArticleSource; constants?: DraftConstantsSource }>;

const notDrafted = (articleCode: string, reason: string, ruleId: string | null = null) =>
  ({ kind: "not-drafted-yet", articleCode, reason, ruleId }) as const;

/**
 * Drafts one size of a base article. The outcome is the pieces, "not drafted yet" with the reason
 * (no script, no article data, no drafting constants, or an option or parameter whose shape the
 * article does not define), or "invalid" with a finding per value the article does not offer.
 * Nothing is guessed or clamped.
 */
export function draftArticle(code: string, size: string, input: DraftInput = {}, sources: DraftSources = {}): DraftOutcome {
  const script = scriptFor(code);
  if (!script) return notDrafted(code, `${NOT_DRAFTED_YET}: there is no drafting script for ${code}.`);
  const article = (sources.articles ?? BUNDLED_ARTICLES).get(code);
  if (!article) return notDrafted(code, `${NOT_DRAFTED_YET}: the article data for ${code} is not available.`);
  const constants = (sources.constants ?? SEEDED_DRAFT_CONSTANTS).get(code);
  if (!constants) return notDrafted(code, `${NOT_DRAFTED_YET}: there are no drafting constants on file for ${code}.`);
  const resolved = resolveInput(article, size, input);
  if (!resolved.ok) return { kind: "invalid", articleCode: code, findings: resolved.findings };
  const stop = script.gate(article, resolved.input, constants);
  if (stop) return notDrafted(code, `${NOT_DRAFTED_YET}: ${stop.reason}`, stop.ruleId);
  return script.draft(article, size, resolved.input, constants, resolved.warnings);
}

export type GradedOutcome =
  | Exclude<DraftOutcome, { kind: "drafted" }>
  | Readonly<{ kind: "drafted"; article: ArticleDefinition; sizes: readonly string[]; drafts: readonly ArticleDraft[] }>;

type NotDrafted = Exclude<DraftOutcome, { kind: "drafted" }>;

/** Every size of the article with the same parameters and options, in the article's size order. */
export function draftAllSizes(code: string, input: DraftInput = {}, sources: DraftSources = {}): GradedOutcome {
  const article = scriptFor(code) ? (sources.articles ?? BUNDLED_ARTICLES).get(code) : null;
  // Without a script or article data, drafting any size gives the same "not drafted yet".
  if (!article) return draftArticle(code, "", input, sources) as NotDrafted;
  const drafts: ArticleDraft[] = [];
  for (const size of article.sizes) {
    const outcome = draftArticle(code, size, input, sources);
    if (outcome.kind !== "drafted") return outcome;
    drafts.push(outcome.draft);
  }
  return { kind: "drafted", article, sizes: article.sizes, drafts };
}
