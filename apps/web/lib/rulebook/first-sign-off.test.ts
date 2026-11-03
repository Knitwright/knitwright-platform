import { describe, expect, it } from "vitest";
import { FIRST_SIGN_OFF_MIGRATION, RULEBOOK_MD } from "./fixtures/files";
import { parseRulebookMarkdown } from "./markdown";
import { waitsFor } from "./sign-off";

/**
 * The first sign-off migration against the sign-off screen's own reading (decision 0130).
 *
 * Two places decide which rules Knitwright owns: `sign-off.ts`, which the screen offers ticked, and the
 * migration's `source_note !~* '…'`, which recorded the owner's sign-off of those same rules. They are written
 * in different languages and cannot import each other, so this reads the SQL, translates Postgres's word
 * boundaries to JavaScript's, and fails if the two ever pick different rules. Without it, a later edit to one
 * reading would leave the database and the screen quietly disagreeing about who has signed what.
 */

/** The deferring pattern the migration uses, as a JavaScript regular expression. */
function migrationPattern(): RegExp {
  const found = /source_note !~\* '([^']*)'/.exec(FIRST_SIGN_OFF_MIGRATION);
  if (!found?.[1]) throw new Error("The migration no longer holds a `source_note !~* '…'` test.");
  return new RegExp(found[1].replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"), "i");
}

const rules = parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01");

describe("the first sign-off migration", () => {
  it("confirms version 1, leaves R-GAP-000 alone, and touches only a draft", () => {
    expect(FIRST_SIGN_OFF_MIGRATION).toContain("e.version = 1");
    expect(FIRST_SIGN_OFF_MIGRATION).toContain("e.status = 'draft'");
    expect(FIRST_SIGN_OFF_MIGRATION).toContain("e.rule_id <> 'R-GAP-000'");
  });

  it("records the sign-off as the owner gave it: a role, and no person named", () => {
    expect(FIRST_SIGN_OFF_MIGRATION).toContain("confirmed_name = 'The factory''s pattern master'");
    expect(FIRST_SIGN_OFF_MIGRATION).toContain("confirmed_role = 'person not named'");
    // A fixed day, so the record reads the same in every database rather than the day it was applied.
    expect(FIRST_SIGN_OFF_MIGRATION).toContain("confirmed_at = '2026-11-03T00:00:00Z'::timestamptz");
  });

  it("writes no schema change and no second statement, so nothing else can ride along", () => {
    const statements = FIRST_SIGN_OFF_MIGRATION.split("\n")
      .filter((line) => !line.trimStart().startsWith("--") && line.trim() !== "")
      .join(" ");
    expect(statements.split(";").filter((part) => part.trim() !== "")).toHaveLength(1);
    expect(statements).not.toMatch(/\b(alter|create|drop|delete|insert|grant|revoke)\b/i);
  });

  it("picks exactly the rules the sign-off screen offers ticked, and leaves exactly the ones it holds back", () => {
    const defers = migrationPattern();
    const signedBySql = rules.filter((rule) => !defers.test(rule.sourceNote)).map((rule) => rule.ruleId).sort();

    expect(signedBySql).toEqual(rules.filter((rule) => waitsFor(rule.sourceNote) === null).map((rule) => rule.ruleId).sort());
    expect(signedBySql).toHaveLength(29);
  });

  it("holds back the sixteen the rulebook's own Source column still defers for", () => {
    const defers = migrationPattern();
    expect(rules.filter((rule) => defers.test(rule.sourceNote)).map((rule) => rule.ruleId).sort()).toEqual([
      "R-CON-004", "R-CON-005", "R-CON-006", "R-CON-008",
      "R-COST-002", "R-COST-003",
      "R-FIT-001",
      "R-LAB-002", "R-LAB-003",
      "R-PAT-001", "R-PAT-003", "R-PAT-008",
      "R-SUB-003", "R-SUB-005", "R-SUB-006", "R-SUB-008",
    ]);
  });
});
