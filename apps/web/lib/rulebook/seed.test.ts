import { describe, expect, it } from "vitest";
import { MIGRATION, RULEBOOK_MD } from "./fixtures/files";
import { parseRulebookMarkdown } from "./markdown";
import { GAP_TEXT } from "./view";

/**
 * The migration's seed is the rulebook word for word: every rule's tuple, as the parser reads it from
 * docs/spec/articles/JSY-SS-01/rulebook.md, appears in the migration exactly once, and nothing else is seeded but
 * R-GAP-000. The database test (tests/integration/rulebook.test.ts) checks the same against the loaded rows.
 */

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: readonly string[]) => (a.length ? `array[${a.map(q).join(", ")}]` : `'{}'::text[]`);

describe("the rulebook seed", () => {
  const rules = parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01");

  it("holds each of the 45 rules exactly as written", () => {
    for (const r of rules) {
      const tuple = `  (${q(r.ruleId)}, ${q(r.topic)}, ${arr(r.articleCodes)},\n   ${q(r.title)},\n   ${q(r.rule)},\n   ${q(r.body)},\n   ${q(r.bestPractice)},\n   ${q(r.source)}, ${q(r.sourceNote)})`;
      expect(MIGRATION.split(tuple).length - 1, r.ruleId).toBe(1);
    }
  });

  it("seeds no rule id the rulebook does not have, except R-GAP-000", () => {
    const seeded = [...MIGRATION.matchAll(/^ {2}\('(R-[A-Z]+-\d{3})'/gm)].map((m) => m[1]);
    expect(seeded.sort()).toEqual(["R-GAP-000", ...rules.map((r) => r.ruleId)].sort());
  });

  it("seeds R-GAP-000 with the plan's words", () => {
    expect(MIGRATION).toContain(`'${GAP_TEXT}'`);
  });
});
