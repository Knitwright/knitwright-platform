import { describe, expect, it } from "vitest";
import { entry } from "./fixtures/entries";
import { inForce, latestOf, rulesInForce, selectRules, versionsOf } from "./select";

/**
 * Owner decision 11: a member is shown the newest version the factory has confirmed, and told when a newer draft
 * is waiting; the Knitwright team is shown the newest version whatever its status, so it can read what it wrote.
 */

const confirmed = (over: Parameters<typeof entry>[0] = {}) =>
  entry({ status: "confirmed", confirmedAt: "2026-11-02T10:00:00Z", confirmedName: "Ana Lima", confirmedRole: "pattern master", ...over });

const rows = [
  confirmed({ id: "a1", ruleId: "R-SUB-004", version: 1 }),
  entry({ id: "a2", ruleId: "R-SUB-004", version: 2, rule: "Version two, a draft" }),
  entry({ id: "b1", ruleId: "R-PAT-001", topic: "pattern", articleCodes: ["JSY-SS-01"], methods: [] }),
  confirmed({ id: "c1", ruleId: "R-PAT-009", topic: "pattern", articleCodes: ["SHO-TR-01"], methods: [] }),
];

describe("versioning", () => {
  it("takes the newest version of each rule, in id order, whatever order the rows come in", () => {
    expect(latestOf([...rows].reverse()).map((e) => e.id)).toEqual(["b1", "c1", "a2"]);
  });

  it("lists every version of a rule, newest first", () => {
    expect(versionsOf(rows, "R-SUB-004").map((e) => e.version)).toEqual([2, 1]);
    expect(versionsOf(rows, "R-NONE-001")).toEqual([]);
  });
});

describe("the version in force", () => {
  const versions = versionsOf(rows, "R-SUB-004");

  it("is the newest confirmed one for a member, who is told a newer draft is waiting", () => {
    expect(inForce(versions, "member")).toEqual({ shown: rows[0], newerDraft: rows[1], newest: rows[1] });
  });

  it("is the newest one for the team, draft or not, with no line about a draft they are looking at", () => {
    expect(inForce(versions, "ops")).toEqual({ shown: rows[1], newerDraft: null, newest: rows[1] });
  });

  it("is nothing for a member when no version is confirmed, and the draft for the team", () => {
    const drafts = [entry({ version: 1 }), entry({ version: 2 })];
    expect(inForce(drafts, "member")).toMatchObject({ shown: null, newerDraft: null, newest: drafts[1] });
    expect(inForce(drafts, "ops")).toMatchObject({ shown: drafts[1] });
  });

  it("is nothing at all for an id with no version", () => {
    for (const reader of ["member", "ops"] as const) {
      expect(inForce([], reader)).toEqual({ shown: null, newerDraft: null, newest: null });
    }
  });

  it("leaves a rule out of the list when the reader may see none of its versions", () => {
    expect(rulesInForce(rows, "member").map((e) => e.id)).toEqual(["c1", "a1"]);
    expect(rulesInForce(rows, "ops").map((e) => e.id)).toEqual(["b1", "c1", "a2"]);
  });
});

describe("rulesFor's filter", () => {
  it("filters by article, by method, by topic, by several or by none", () => {
    expect(selectRules(rows, { articleCode: "JSY-SS-01" }, "ops").map((e) => e.id)).toEqual(["b1"]);
    expect(selectRules(rows, { method: "sublimation" }, "ops").map((e) => e.id)).toEqual(["a2"]);
    expect(selectRules(rows, { articleCode: "JSY-SS-01", method: "sublimation" }, "ops").map((e) => e.id)).toEqual(["b1", "a2"]);
    expect(selectRules(rows, { topic: "pattern" }, "ops").map((e) => e.id)).toEqual(["b1", "c1"]);
    expect(selectRules(rows, { articleCode: "SHO-TR-01", topic: "pattern" }, "ops").map((e) => e.id)).toEqual(["c1"]);
    expect(selectRules(rows, {}, "ops")).toHaveLength(3);
  });

  it("asks nothing of the reader but shows them only what they may see", () => {
    expect(selectRules(rows, {}).map((e) => e.id)).toEqual(["c1", "a1"]);
  });
});
