import { RULEBOOK_MD } from "../../fixtures/files";
import { familyOf, parseRulebookMarkdown, SHARED_FAMILIES } from "../../markdown";
import { SCOPE_NOT_REVIEWED, SUBLIMATION } from "../../scope";
import { sourceOf } from "../../sources";
import type { RulebookEntry } from "../../types";

/**
 * The real rulebook as fixtures: all 45 rules of `docs/spec/articles/JSY-SS-01/rulebook.md`, read through
 * `lib/rulebook/markdown.ts`, scoped the way owner decisions 12 and 13 scope them, so the question set runs
 * against the words a factory will actually read rather than against invented test prose.
 *
 * Every rule is a draft, as the seed has them. So that the member path can be tested as well as the team's, each
 * rule is offered twice: as drafts (`DRAFT_RULES`), where a member sees nothing, and with version 1 recorded as
 * reviewed (`REVIEWED_RULES`), which is the state the rulebook reaches once the factory has been through it.
 */

export const ARTICLE = "JSY-SS-01";

const REVIEWED = {
  status: "confirmed" as const,
  confirmedAt: "2026-11-20T10:00:00Z",
  confirmedName: "Ana Lima",
  confirmedRole: "pattern master",
};

const seeded = parseRulebookMarkdown(RULEBOOK_MD, ARTICLE);

const entryOf = (index: number, rule: (typeof seeded)[number]): RulebookEntry => {
  const shared = SHARED_FAMILIES.has(familyOf(rule.ruleId));
  return {
    id: `fixture-${index}`,
    ruleId: rule.ruleId,
    version: 1,
    topic: rule.topic,
    articleCodes: shared ? [] : [...rule.articleCodes],
    methods: shared ? [SUBLIMATION] : [],
    scopeNote: shared ? SCOPE_NOT_REVIEWED : "",
    title: rule.title,
    rule: rule.rule,
    body: rule.body,
    bestPractice: rule.bestPractice,
    source: sourceOf(rule.sourceNote),
    sourceNote: rule.sourceNote,
    status: "draft",
    confirmedBy: null,
    confirmedName: null,
    confirmedRole: null,
    confirmedAt: null,
    createdAt: "2026-11-01T02:00:00Z",
  };
};

/** All 45 rules, as the seed holds them: version 1, every one a draft. */
export const DRAFT_RULES: readonly RulebookEntry[] = seeded.map((rule, index) => entryOf(index, rule));

/** The same 45 rules with version 1 reviewed by the factory, which is what a member may be shown. */
export const REVIEWED_RULES: readonly RulebookEntry[] = DRAFT_RULES.map((entry) => ({ ...entry, ...REVIEWED }));

export const ruleOf = (entries: readonly RulebookEntry[], ruleId: string): RulebookEntry => {
  const found = entries.find((entry) => entry.ruleId === ruleId);
  if (!found) throw new Error(`No fixture rule ${ruleId}`);
  return found;
};
