import { z } from "zod";
import { NOT_DRAFTED_YET } from "../types";
import seeded from "./data/not-drafted.json";

/**
 * Why each launch article other than `JSY-SS-01` has no drafting script (plan v5 workstream Z9, decision 0090).
 *
 * `draftArticle` already answers "not drafted yet" for an article with no script, but it can only say that there is
 * no script. This register says why there is none and what a drafter would need before there could be one: every
 * one of the seven has no point of measure from a factory and no block on file, so a drafted shape would be an
 * invented measurement. Each entry is read from the article's own brief, which is where the reason and the rule
 * that explains it are written down, so the two cannot drift apart.
 *
 * No geometry and no number live here. Adding a script is adding an `ArticleScript` and a row of `ARTICLE_SCRIPTS`,
 * which is the drafting engine's own file, not this directory's.
 */

const entrySchema = z.object({
  code: z.string().regex(/^[A-Z]{3}-[A-Z]{2}-\d{2}$/),
  name: z.string().min(1),
  status: z.literal("not drafted yet"),
  reason: z.string().min(1),
  /** The rulebook entry that explains the gap, which is the article's "no block on file" rule. */
  rule: z.string().regex(/^R-[A-Z]+-\d{3}$/),
  /** The points of measure a drafter would need, in the words of the brief. */
  needs: z.array(z.string().min(1)).min(1),
});

export type NotDraftedArticle = z.output<typeof entrySchema>;

const registerSchema = z.object({ note: z.string().min(1), articles: z.array(entrySchema).min(1) });

/**
 * Where the drafter reads the gaps. The same seam as the article and the constants: the committed register stands
 * in until the catalogue carries the reason on the article row itself.
 */
export interface NotDraftedSource {
  get(code: string): NotDraftedArticle | null;
  all(): readonly NotDraftedArticle[];
}

export function notDraftedSource(articles: readonly NotDraftedArticle[]): NotDraftedSource {
  const byCode = new Map(articles.map((article) => [article.code, article]));
  return { get: (code) => byCode.get(code) ?? null, all: () => articles };
}

/** The register committed in `data/not-drafted.json`, which no factory has reviewed. */
export const SEEDED_NOT_DRAFTED: NotDraftedSource = notDraftedSource(registerSchema.parse(seeded).articles);

/** Why this article is not drafted, in the drafter's own words, or null when the register has no entry for it. */
export function notDraftedReason(code: string, source: NotDraftedSource = SEEDED_NOT_DRAFTED): string | null {
  const entry = source.get(code);
  return entry ? `${NOT_DRAFTED_YET}: ${entry.reason}` : null;
}

/** The points of measure this article would need before it could be drafted. Empty when it is not in the register. */
export const needsBeforeDrafting = (code: string, source: NotDraftedSource = SEEDED_NOT_DRAFTED): readonly string[] =>
  source.get(code)?.needs ?? [];
