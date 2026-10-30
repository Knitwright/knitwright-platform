import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRAFT_CODES } from "./draft-article";
import { draftRuleProblems, parseDraftRulebook, ruleIdsOf, uncitedRules } from "./rulebook-draft";

/** The repository root, from apps/web/lib/catalogue/seed. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const rulebookOf = (code: string): string =>
  readFileSync(join(REPO_ROOT, "docs", "spec", "articles", code, "rulebook.md"), "utf8");

/** The two rule ids the build pack itself gives these articles, which are used as published rather than renumbered. */
const PUBLISHED_IDS: Readonly<Record<string, readonly string[]>> = {
  "SHO-TR-01": ["R-SHO-002"],
  "CMP-LS-01": ["R-CON-011"],
};

const BLOCK_OF: Readonly<Record<string, string>> = {
  "SHO-TR-01": "1",
  "JSY-LS-01": "2",
  "CRK-SS-01": "3",
  "TEE-TR-01": "4",
  "HOD-ST-01": "5",
  "CMP-LS-01": "6",
  "FSH-MM-01": "7",
};

describe("the rulebook of an article with no factory block", () => {
  it("is on file for each of the seven, and every row is complete and still a draft", () => {
    for (const code of DRAFT_CODES) {
      const rules = parseDraftRulebook(rulebookOf(code));
      expect(rules.length).toBeGreaterThanOrEqual(3);
      expect([code, draftRuleProblems(rules)]).toEqual([code, []]);
    }
  });

  it("cites the build pack or the plan for every rule, so no entry rests on an unnamed practice", () => {
    for (const code of DRAFT_CODES) expect([code, uncitedRules(parseDraftRulebook(rulebookOf(code)))]).toEqual([code, []]);
  });

  it("carries the three rules every one of them needs: no block, no tolerance, no construction", () => {
    for (const code of DRAFT_CODES) {
      const block = BLOCK_OF[code];
      expect(ruleIdsOf(rulebookOf(code))).toEqual(
        expect.arrayContaining([`R-PAT-${block}01`, `R-FIT-${block}01`, `R-CON-${block}01`]),
      );
    }
  });

  it("numbers its own rules in the article's own block, and reuses a published id where there is one", () => {
    for (const code of DRAFT_CODES) {
      const published = PUBLISHED_IDS[code] ?? [];
      const own = ruleIdsOf(rulebookOf(code)).filter((id) => !published.includes(id));
      for (const id of own) expect([code, id.slice(-3, -2)]).toEqual([code, BLOCK_OF[code]]);
    }
  });

  it("gives the same rule id to no two articles", () => {
    const all = [...DRAFT_CODES, "JSY-SS-01"].flatMap((code) => ruleIdsOf(rulebookOf(code)));
    expect(all.length).toBe(new Set(all).size);
  });
});

describe("reading the worked article's rulebook with the same reader", () => {
  it("finds its rules, every row complete and still a draft", () => {
    const rules = parseDraftRulebook(rulebookOf("JSY-SS-01"));
    expect(rules.length).toBeGreaterThan(40);
    expect(draftRuleProblems(rules)).toEqual([]);
  });

  it("names its rules of practice as uncited, which is why the seven cite a file instead", () => {
    expect(uncitedRules(parseDraftRulebook(rulebookOf("JSY-SS-01")))).toContain("R-PAT-002");
  });
});

describe("a rulebook row with something wrong", () => {
  const problemsOf = (markdown: string): readonly string[] => draftRuleProblems(parseDraftRulebook(markdown));

  it("reports a row with the wrong number of cells", () => {
    expect(problemsOf("| R-PAT-101 | a | b | c | d | e |")).toContain("R-PAT-101: 6 cells, not 7.");
  });

  it("reports a cell left empty", () => {
    expect(problemsOf("| R-PAT-101 | a | b |  | d | e | draft |")).toContain("R-PAT-101: the why cell is empty.");
  });

  it("reports a rule that claims to be confirmed", () => {
    expect(problemsOf("| R-PAT-101 | a | b | c | d | e | confirmed |")).toContain("R-PAT-101: status confirmed, not draft.");
  });

  it("reports an id that is not a rule id, and one used twice", () => {
    expect(problemsOf("| R-pat-1 | a | b | c | d | e | draft |")).toContain("R-pat-1: not a rule id.");
    const twice = "| R-PAT-101 | a | b | c | d | e | draft |\n| R-PAT-101 | a | b | c | d | e | draft |";
    expect(problemsOf(twice)).toContain("R-PAT-101: appears twice in the same file.");
  });

  it("reads nothing out of a file with no rule rows", () => {
    expect(parseDraftRulebook("# Rulebook\n\nNo rules yet.\n")).toEqual([]);
  });
});
