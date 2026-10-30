import { describe, expect, it } from "vitest";
import { entry } from "./fixtures/entries";
import { claimsEveryArticle, inScope, scopeLabel, SCOPE_NOT_REVIEWED, SHARED_SCOPE, SUBLIMATION } from "./scope";

/**
 * Owner decision 12: a rule reaches as far as its source and no further. The shared families cover the
 * sublimation method, not every article, and say that nobody at a factory has reviewed that scope.
 */

const shared = entry({ articleCodes: [], methods: [SUBLIMATION], scopeNote: SCOPE_NOT_REVIEWED });
const jersey = entry({ ruleId: "R-PAT-001", articleCodes: ["JSY-SS-01"], methods: [], scopeNote: "" });
const unscoped = entry({ ruleId: "R-XX-001", articleCodes: [], methods: [], scopeNote: "" });

describe("what a rule covers", () => {
  it("matches a rule to the article it names", () => {
    expect(inScope(jersey, { articleCode: "JSY-SS-01" })).toBe(true);
    expect(inScope(jersey, { articleCode: "SHO-TR-01" })).toBe(false);
  });

  it("matches a shared rule to the method it names, and not to an article it never saw", () => {
    expect(inScope(shared, { method: SUBLIMATION })).toBe(true);
    expect(inScope(shared, { articleCode: "SHO-TR-01" })).toBe(false);
    expect(inScope(shared, { articleCode: "SHO-TR-01", method: SUBLIMATION })).toBe(true);
    expect(inScope(shared, { method: "embroidery" })).toBe(false);
  });

  it("matches every rule when nothing in particular is asked about", () => {
    expect([shared, jersey, unscoped].every((rule) => inScope(rule, {}))).toBe(true);
  });
});

describe("a scope wider than its source", () => {
  it("is what a rule naming neither an article nor a method claims", () => {
    expect(claimsEveryArticle(unscoped)).toBe(true);
    expect(claimsEveryArticle(shared)).toBe(false);
    expect(claimsEveryArticle(jersey)).toBe(false);
  });

  it("is not what R-GAP-000 claims: it stands in for a check with no rule and covers nothing", () => {
    expect(claimsEveryArticle(entry({ ruleId: "R-GAP-000", articleCodes: [], methods: [], scopeNote: "" }))).toBe(false);
  });
});

describe("the scope in plain words", () => {
  it("names the articles, or the method with the note that says how far it was checked", () => {
    expect(scopeLabel(jersey)).toBe("JSY-SS-01");
    expect(scopeLabel(shared)).toBe("the sublimation method (scope not reviewed by a factory)");
    expect(scopeLabel(entry({ methods: ["sublimation", "embroidery"], scopeNote: "" }))).toBe("the sublimation and embroidery methods");
    expect(scopeLabel(unscoped)).toBe("no article in particular");
  });

  it("never reads as every article", () => {
    for (const rule of [shared, jersey, unscoped]) expect(scopeLabel(rule)).not.toContain("every article");
  });
});

describe("the scope the shared families are seeded with", () => {
  it("is the sublimation method, labelled as not reviewed", () => {
    expect(SHARED_SCOPE).toEqual({ methods: ["sublimation"], note: "scope not reviewed by a factory" });
  });
});
