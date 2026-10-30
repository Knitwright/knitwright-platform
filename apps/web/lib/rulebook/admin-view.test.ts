import { describe, expect, it } from "vitest";
import { adminGroups, stamp } from "./admin-view";
import { entry } from "./fixtures/entries";

describe("adminGroups", () => {
  const rows = [
    entry({ id: "p1", ruleId: "R-PAT-001", topic: "pattern" }),
    entry({ id: "s1", ruleId: "R-SUB-004", version: 1 }),
    entry({
      id: "s2", ruleId: "R-SUB-004", version: 2, status: "confirmed", confirmedAt: "2026-11-02T10:00:00Z",
      confirmedBy: "u1", confirmedName: "Ana Lima", confirmedRole: "pattern master", rule: "New words",
    }),
    entry({ id: "g1", ruleId: "R-GAP-000", topic: null }),
  ];

  it("groups the newest version of each rule by topic, in a fixed order, with the gap rule last", () => {
    const groups = adminGroups(rows, {});
    expect(groups.map((g) => [g.topic, g.title, g.rules.map((r) => r.entry.id)])).toEqual([
      ["print", "Sublimation and print", ["s2"]],
      ["pattern", "Pattern", ["p1"]],
      ["other", "Not about one topic", ["g1"]],
    ]);
  });

  it("names the factory person who reviewed it, who recorded it, and keeps the earlier versions", () => {
    const [print] = adminGroups(rows, { u1: "ada@example.com" });
    expect(print!.rules[0]).toMatchObject({
      status: "Reviewed by Ana Lima, pattern master, on 2026-11-02",
      confirmedByName: "ada@example.com",
      earlier: [{ version: 1, status: "Draft, not yet confirmed by the factory", rule: entry().rule, body: entry().body }],
    });
  });

  it("says how far each rule reaches, and never that it covers every article (owner decision 12)", () => {
    const groups = adminGroups(rows, {});
    const scopes = groups.flatMap((group) => group.rules.map((rule) => rule.scope));
    expect(scopes[0]).toBe("the sublimation method (scope not reviewed by a factory)");
    for (const scope of scopes) expect(scope).not.toContain("every article");
  });

  it("leaves the name out when it is not known", () => {
    expect(adminGroups(rows, {})[0]!.rules[0]!.confirmedByName).toBeNull();
    expect(adminGroups(rows, {})[1]!.rules[0]!.confirmedByName).toBeNull();
  });
});

describe("stamp", () => {
  it("shows a time in UTC", () => {
    expect(stamp("2026-11-02T10:05:59.123Z")).toBe("2026-11-02 10:05 UTC");
  });
});
