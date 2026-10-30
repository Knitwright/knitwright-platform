import { describe, expect, it } from "vitest";
import { SOURCES } from "./constants";
import { RESEED_MIGRATION, RULEBOOK_MD } from "./fixtures/files";
import { parseRulebookMarkdown, SHARED_FAMILIES, familyOf } from "./markdown";
import { claimsEveryArticle, SCOPE_NOT_REVIEWED, SHARED_SCOPE, SUBLIMATION } from "./scope";
import { misfiledAsFactory, sourceOf } from "./sources";

/**
 * The follow-up migration (owner decisions 12 and 13) against a fresh reading of the rulebook: it refiles every
 * source note that named somebody other than the factory, scopes the four shared families to the sublimation
 * method, and leaves no rule claiming a scope wider than its source. The database test
 * (tests/integration/rulebook.test.ts) checks the same against the loaded rows.
 */

const rules = parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01");

/** How each rule stands after the migration: the scope it carries and the source it is filed under. */
const reseeded = rules.map((rule) => {
  const share = SHARED_FAMILIES.has(familyOf(rule.ruleId));
  return {
    ruleId: rule.ruleId,
    articleCodes: rule.articleCodes,
    methods: share ? SHARED_SCOPE.methods : [],
    scopeNote: share ? SHARED_SCOPE.note : "",
    source: sourceOf(rule.sourceNote),
    sourceNote: rule.sourceNote,
  };
});

describe("the source kinds", () => {
  it("hold the supplier kind the migration adds, and no other", () => {
    const check = /check \(source in \(([^)]*)\)\)/.exec(RESEED_MIGRATION)?.[1] ?? "";
    expect([...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...SOURCES].sort());
  });
});

describe("the refiling", () => {
  const listed = [...RESEED_MIGRATION.matchAll(/\('(R-[A-Z]+-\d{3})', '([a-z_]+)'\)/g)].map((m) => [m[1], m[2]]);

  it("names every rule whose source moves, with the kind it moves to, and nothing else", () => {
    const moved = rules
      .filter((rule) => sourceOf(rule.sourceNote) !== rule.source)
      .map((rule) => [rule.ruleId, sourceOf(rule.sourceNote)]);
    expect(listed).toEqual(moved);
  });

  it("files nothing under pattern_master", () => {
    expect(listed.filter(([, source]) => source === "pattern_master")).toEqual([]);
  });

  it("leaves no rule filed as the factory that the factory did not say", () => {
    expect(reseeded.filter(misfiledAsFactory)).toEqual([]);
  });
});

describe("the scope of the shared rules", () => {
  it("is the sublimation method, labelled as not reviewed by a factory", () => {
    expect(RESEED_MIGRATION).toContain(`set scope_methods = array['${SUBLIMATION}'], scope_note = '${SCOPE_NOT_REVIEWED}'`);
    for (const family of SHARED_FAMILIES) expect(RESEED_MIGRATION, family).toContain(`'${family}'`);
  });

  it("covers every shared rule and only those", () => {
    const shared = reseeded.filter((rule) => rule.methods.length > 0).map((rule) => rule.ruleId);
    expect(shared.every((ruleId) => SHARED_FAMILIES.has(familyOf(ruleId)))).toBe(true);
    expect(shared).toHaveLength(16);
  });

  it("leaves no rule claiming a scope wider than its source", () => {
    expect(reseeded.filter(claimsEveryArticle)).toEqual([]);
  });
});

describe("the confirmation", () => {
  it("names the factory person, and the migration refuses a confirmation that does not", () => {
    expect(RESEED_MIGRATION).toContain("add column confirmed_name text");
    expect(RESEED_MIGRATION).toContain("add column confirmed_role text");
    expect(RESEED_MIGRATION).toContain("Write the name and role of the factory person who reviewed the rule.");
    // The three-argument function, which could confirm a rule with nobody against it, is gone.
    expect(RESEED_MIGRATION).toContain("drop function public.rulebook_entry_confirm(uuid, text, integer);");
  });
});

describe("the append-only guard", () => {
  it("is switched off only for the two statements that correct the seed, and switched straight back on", () => {
    const off = RESEED_MIGRATION.indexOf("disable trigger rulebook_entries_are_versioned");
    const on = RESEED_MIGRATION.indexOf("enable trigger rulebook_entries_are_versioned");
    expect(off).toBeGreaterThan(0);
    expect(on).toBeGreaterThan(off);
    expect(RESEED_MIGRATION.slice(off, on).match(/^update /gm)).toHaveLength(2);
  });
});
