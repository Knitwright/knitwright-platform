import { GAP_RULE_ID } from "@/lib/rulebook/constants";

/**
 * The rulebook entry behind each gap a tech pack template can report (plan v5 L8, decision 0098).
 *
 * No rule's text is written here, and no id is made up: every id below is published in that article's
 * own `docs/spec/articles/<CODE>/rulebook.md`, and `rules.test.ts` reads those files and holds this
 * table to them. The three facts true of all seven draft articles each have an entry of their own in
 * every brief (decision 0090, point 6): no block on file so nothing may be drafted (`R-PAT-x01`), no
 * point of measure without a factory value **and** a tolerance (`R-FIT-x01`), and no construction,
 * seam allowance or thread on file (`R-CON-x01`).
 *
 * `JSY-SS-01` is not in the table because it has all three: it is the one article with a
 * factory-shaped brief. Where a gap has no entry anywhere, `R-GAP-000` is used and listed in the
 * pull request, as the plan asks.
 */

/** What a tech pack page needs from the article before it can be filled. */
export const GAP_KINDS = ["poms", "pattern", "construction", "drawing", "fabric"] as const;
export type GapKind = (typeof GAP_KINDS)[number];

const ARTICLE_RULES: Readonly<Record<string, Readonly<Record<"poms" | "pattern" | "construction", string>>>> = {
  "SHO-TR-01": { poms: "R-FIT-101", pattern: "R-PAT-101", construction: "R-CON-101" },
  "JSY-LS-01": { poms: "R-FIT-201", pattern: "R-PAT-201", construction: "R-CON-201" },
  "CRK-SS-01": { poms: "R-FIT-301", pattern: "R-PAT-301", construction: "R-CON-301" },
  "TEE-TR-01": { poms: "R-FIT-401", pattern: "R-PAT-401", construction: "R-CON-401" },
  "HOD-ST-01": { poms: "R-FIT-501", pattern: "R-PAT-501", construction: "R-CON-501" },
  "CMP-LS-01": { poms: "R-FIT-601", pattern: "R-PAT-601", construction: "R-CON-601" },
  "FSH-MM-01": { poms: "R-FIT-701", pattern: "R-PAT-701", construction: "R-CON-701" },
};

/** The articles whose gaps have a rulebook entry of their own. */
export const ARTICLES_WITH_GAP_RULES: readonly string[] = Object.keys(ARTICLE_RULES);

/**
 * The rule that explains this gap for this article, or `R-GAP-000` where no rulebook entry fits yet:
 * a garment with no type in the editor has no drawing to put on the page, and no rule says so; nor
 * does any entry of `JSY-SS-01`'s rulebook say that an article needs a factory-checked master
 * pattern before it may be sold, which is the plan's owner decision 10 rather than a factory's rule.
 */
export function ruleForGap(code: string, kind: GapKind): string {
  if (kind === "drawing" || kind === "fabric") return GAP_RULE_ID;
  return ARTICLE_RULES[code]?.[kind] ?? GAP_RULE_ID;
}
