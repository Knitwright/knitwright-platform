import { GAP_RULE_ID, type RulebookEntry } from "./constants";

/**
 * How far a rule reaches (owner decision 12). A rule covers the articles it names, or the way of making a garment
 * it names, and nothing wider: the R-SUB, R-LAB, R-QC and R-COST rules came out of one sublimated jersey's
 * rulebook, so they cover the sublimation method, not every article. Widening them would state a fact the rulebook
 * does not contain, so the scope says it has not been reviewed until a factory confirms it.
 */

/** The one method the JSY-SS-01 rulebook covers. Others are added as rules are written for them, as data. */
export const SUBLIMATION = "sublimation";

/** The label the seed carries, word for word. It says the scope is Knitwright's reading, not a factory's. */
export const SCOPE_NOT_REVIEWED = "scope not reviewed by a factory";

/** The scope the four shared families are seeded with. */
export const SHARED_SCOPE = { methods: [SUBLIMATION] as readonly string[], note: SCOPE_NOT_REVIEWED } as const;

export type RuleScope = Pick<RulebookEntry, "ruleId" | "articleCodes" | "methods" | "scopeNote">;

/** What a reader is asking about: one article, one way of making it, or neither. */
export type ScopeAsk = Readonly<{ articleCode?: string; method?: string }>;

/**
 * Whether a rule covers what was asked about. Asking about nothing in particular matches every rule; asking about
 * an article or a method matches only the rules that name it, so no rule is stretched over an article it never saw.
 */
export function inScope(rule: RuleScope, ask: ScopeAsk): boolean {
  if (ask.articleCode === undefined && ask.method === undefined) return true;
  return (
    (ask.articleCode !== undefined && rule.articleCodes.includes(ask.articleCode)) ||
    (ask.method !== undefined && rule.methods.includes(ask.method))
  );
}

/**
 * A rule that names neither an article nor a method claims every article, which is wider than any source the
 * rulebook holds. R-GAP-000 is not such a claim: it stands in for a check with no rule and covers nothing.
 */
export const claimsEveryArticle = (rule: RuleScope): boolean =>
  rule.ruleId !== GAP_RULE_ID && rule.articleCodes.length === 0 && rule.methods.length === 0;

/** The scope in plain words, with the note that says how far it was checked. */
export function scopeLabel(rule: RuleScope): string {
  const reach =
    rule.articleCodes.length > 0
      ? rule.articleCodes.join(", ")
      : rule.methods.length > 0
        ? `the ${rule.methods.join(" and ")} method${rule.methods.length > 1 ? "s" : ""}`
        : "no article in particular";
  return rule.scopeNote ? `${reach} (${rule.scopeNote})` : reach;
}
