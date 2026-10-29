import { describe, expect, it } from "vitest";
import { entry } from "./fixtures/entries";
import { appliesTo, latestOf, selectRules, versionsOf } from "./select";

const rows = [
  entry({ id: "a1", ruleId: "R-SUB-004", version: 1 }),
  entry({ id: "a2", ruleId: "R-SUB-004", version: 2, rule: "Version two" }),
  entry({ id: "b1", ruleId: "R-PAT-001", topic: "pattern", articleCodes: ["JSY-SS-01"] }),
  entry({ id: "c1", ruleId: "R-PAT-009", topic: "pattern", articleCodes: ["SHO-TR-01"] }),
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

describe("rulesFor's filter", () => {
  it("treats a rule with no article code as shared by every article", () => {
    expect(appliesTo(rows[0]!, "ANY-01")).toBe(true);
    expect(appliesTo(rows[2]!, "JSY-SS-01")).toBe(true);
    expect(appliesTo(rows[2]!, "SHO-TR-01")).toBe(false);
  });

  it("filters by article, by topic, by both or by neither", () => {
    expect(selectRules(rows, { articleCode: "JSY-SS-01" }).map((e) => e.id)).toEqual(["b1", "a2"]);
    expect(selectRules(rows, { topic: "pattern" }).map((e) => e.id)).toEqual(["b1", "c1"]);
    expect(selectRules(rows, { articleCode: "SHO-TR-01", topic: "pattern" }).map((e) => e.id)).toEqual(["c1"]);
    expect(selectRules(rows, {})).toHaveLength(3);
  });
});
