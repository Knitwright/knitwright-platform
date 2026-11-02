import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { askSchema, bestPracticeSchema } from "./input";
import { MAX_QUESTION_LENGTH } from "./prompt";

/**
 * The search migration, read as text (decision 0083). The database behaviour itself is asserted against a real
 * database in `tests/integration/rulebook-search.test.ts`, which needs local Supabase; these are the promises
 * that can be kept without one, and the most important of them is the first.
 */

const REPO = join(__dirname, "..", "..", "..", "..", "..");
const MIGRATION = readFileSync(join(REPO, "supabase", "migrations", "20261120020000_rulebook_search.sql"), "utf8");

describe("the search migration", () => {
  it("needs no extension, so the search works on any Postgres this repository runs on", () => {
    expect(MIGRATION).not.toMatch(/create\s+extension/i);
    expect(MIGRATION).not.toMatch(/\bvector\s*\(/i);
    expect(MIGRATION).not.toMatch(/::vector\b/i);
    // And it says why, in the file, so the next person does not have to go looking for whether it was considered.
    expect(MIGRATION).toContain("vector 0.8.2");
  });

  it("derives the searched words from the version's own columns, so they can never drift from them", () => {
    expect(MIGRATION).toMatch(/generated always as/i);
    for (const column of ["title", "rule", "body", "best_practice"]) {
      expect(MIGRATION, column).toContain(`coalesce(${column}, '')`);
    }
  });

  it("does not grant the new column to a browser, so a rule's words are read on the server", () => {
    expect(MIGRATION).not.toMatch(/grant select\s*\([^)]*search/i);
    expect(MIGRATION).toMatch(/grant execute on function public\.rulebook_search\(text, text, text, integer\)\s*\n?\s*to service_role/);
    expect(MIGRATION).toMatch(/revoke all on function public\.rulebook_search\(text, text, text, integer\) from public, anon, authenticated/);
  });

  it("adds the index workstream X2b asked for before the table passes 500 versions", () => {
    expect(MIGRATION).toMatch(/create index rulebook_entries_rule_version on public\.rulebook_entries \(rule_id, version desc\)/);
    expect(MIGRATION).toMatch(/using gin \(search\)/);
  });

  it("filters the scope in SQL the way owner decision 12 reads it, and never widens a rule", () => {
    expect(MIGRATION).toContain("p_article_code = any (e.article_codes)");
    expect(MIGRATION).toContain("p_method = any (e.scope_methods)");
    expect(MIGRATION).toContain("(p_article_code is null and p_method is null)");
  });

  it("returns ids and scores only, so which version a reader sees stays owner decision 11's business", () => {
    expect(MIGRATION).toMatch(/returns setof public\.rulebook_hit/);
    expect(MIGRATION).not.toMatch(/returns setof public\.rulebook_entries/);
    expect(MIGRATION).not.toMatch(/select e\.\*/);
  });

  it("writes no row and changes nothing the earlier rulebook migrations made, apart from adding to the table", () => {
    expect(MIGRATION).not.toMatch(/\binsert into\b/i);
    expect(MIGRATION).not.toMatch(/\bupdate public\./i);
    expect(MIGRATION).not.toMatch(/\bdrop\b/i);
  });

  it("is the file the plan assigned to this workstream", () => {
    const plan = readFileSync(join(REPO, "plans", "platform-v5.md"), "utf8");
    expect(plan).toContain("20261120020000_rulebook_search.sql");
  });
});

describe("what the Ask box may send", () => {
  it("takes a question, and an article code and a method that are ids rather than prose", () => {
    const parsed = askSchema.safeParse({ question: "How far from a seam?", articleCode: "jsy-ss-01", method: "Sublimation" });
    expect(parsed.success && parsed.data).toEqual({ question: "How far from a seam?", articleCode: "JSY-SS-01", method: "sublimation" });
  });

  it("reads an empty field as not given, not as an empty code", () => {
    const parsed = askSchema.safeParse({ question: "Why?!?", articleCode: "", method: "" });
    expect(parsed.success && parsed.data).toEqual({ question: "Why?!?", articleCode: undefined, method: undefined });
  });

  it("refuses a question that is empty, far too long, or an article code that is prose", () => {
    expect(askSchema.safeParse({ question: " " }).success).toBe(false);
    expect(askSchema.safeParse({ question: "x".repeat(MAX_QUESTION_LENGTH + 1) }).success).toBe(false);
    expect(askSchema.safeParse({ question: "Why?", articleCode: "a jersey, please" }).success).toBe(false);
    expect(askSchema.safeParse({ question: "Why?", method: "SUBLIMATION!" }).success).toBe(false);
  });

  it("takes only a part the card knows about", () => {
    expect(bestPracticeSchema.safeParse({ part: "collar" }).success).toBe(true);
    expect(bestPracticeSchema.safeParse({ part: "zip" }).success).toBe(false);
  });
});
