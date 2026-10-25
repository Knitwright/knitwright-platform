import { describe, expect, it } from "vitest";
import { DEFAULT_NOTE, buildGroups } from "./view";

const all = (groups: ReturnType<typeof buildGroups>) => groups.flatMap((g) => g.settings);

describe("buildGroups", () => {
  it("shows the Knitwright default label for every setting while nothing is stored", () => {
    const settings = all(buildGroups({}, {}, {}));
    expect(settings.length).toBeGreaterThan(10);
    for (const s of settings) {
      expect(s.source, s.key).toBe(DEFAULT_NOTE);
      expect(s.isSet).toBe(false);
    }
    expect(settings.find((s) => s.key === "ops.cutoff_minutes")?.text).toBe("17:00");
    expect(settings.find((s) => s.key === "ops.lead_time_days")?.text).toBe("");
  });

  it("shows 'set by <admin> on <date>' and the history once stored", () => {
    const stored = { "ops.cutoff_minutes": { value: 420, setBy: "u1", setAt: "2026-10-27T08:00:00Z" } };
    const history = { "ops.cutoff_minutes": [
      { id: "h2", value: 420, setBy: "u1", setAt: "2026-10-27T08:00:00Z" },
      { id: "h1", value: null, setBy: null, setAt: "2026-10-26T08:00:00Z" },
    ] };
    const s = all(buildGroups(stored, { u1: "ada@example.com" }, history)).find((x) => x.key === "ops.cutoff_minutes")!;
    expect(s.source).toBe("Set by ada@example.com on 2026-10-27");
    expect(s.text).toBe("07:00");
    expect(s.isSet).toBe(true);
    expect(s.history).toEqual([
      "2026-10-27: was set to 07:00, by ada@example.com",
      "2026-10-26: went back to the Knitwright default, by a platform admin",
    ]);
  });

  it("groups settings under plain headings and skips empty groups", () => {
    const groups = buildGroups({}, {}, {});
    expect(groups.map((g) => g.title)).toEqual(expect.arrayContaining(["Credits", "Weekly batch", "Print file checks", "Marketing media", "Factory terms"]));
    expect(groups.map((g) => g.id)).not.toContain("checker");
  });
});
