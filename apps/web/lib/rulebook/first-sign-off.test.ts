import { describe, expect, it } from "vitest";
import { FIRST_SIGN_OFF_MIGRATION, RULEBOOK_MD, SIGN_OFF_TITLE_MIGRATION } from "./fixtures/files";
import { parseRulebookMarkdown } from "./markdown";
import { waitsFor } from "./sign-off";
import { statusLabel } from "./view";

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

/**
 * The correction of the same day (decision 0130): the owner asked for the title alone, so the two strings the
 * first migration wrote are replaced. What this test holds is that the correction cannot reach anything but
 * those rows, that it leaves the append-only guard on, and that the words it writes are words `statusLabel`
 * says once rather than twice.
 */
describe("the correction to the title alone", () => {
  /** The migration with its comments taken out, so a word in a comment can satisfy nothing below. */
  const sql = SIGN_OFF_TITLE_MIGRATION.split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  /** What the UPDATE sets, read out of the statement rather than the file. */
  const update = /\bupdate\b([\s\S]*?);/i.exec(sql)?.[1] ?? "";
  const written = (column: string): string => {
    const found = new RegExp(`set[\\s\\S]*?\\b${column} = '([^']*)'`).exec(update);
    if (!found?.[1]) throw new Error(`The correction no longer sets ${column}.`);
    return found[1];
  };

  it("touches only the rows the first sign-off wrote, by the exact strings it set", () => {
    expect(update).toContain("confirmed_name = 'The factory''s pattern master'");
    expect(update).toContain("confirmed_role = 'person not named'");
    expect(update).toContain("status = 'confirmed'");
  });

  it("moves nothing about which rules were signed off, or when", () => {
    expect(update).not.toMatch(/\bconfirmed_at\b|\brule_id\b|\bsource_note\b|\bstatus = 'draft'/);
    expect(sql.split(";").filter((part) => /\bupdate\b/i.test(part))).toHaveLength(1);
  });

  it("switches the append-only guard off for the one statement and straight back on", () => {
    const off = sql.indexOf("disable trigger rulebook_entries_are_versioned");
    const on = sql.indexOf("enable trigger rulebook_entries_are_versioned");
    expect(off).toBeGreaterThan(-1);
    expect(on).toBeGreaterThan(off);
    expect(sql.slice(off, on)).toContain("update public.rulebook_entries");
  });

  it("writes words a reader is shown once, with no person in the line", () => {
    expect(
      statusLabel({
        status: "confirmed",
        confirmedAt: "2026-11-03T00:00:00.000Z",
        confirmedName: written("confirmed_name"),
        confirmedRole: written("confirmed_role"),
      }),
    ).toBe("Reviewed by The pattern master on 2026-11-03");
  });
});
