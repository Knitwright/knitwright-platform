import { describe, expect, it } from "vitest";
import { findingsHash, sortFindings } from "./hash";
import { finding } from "./finding";

describe("findings", () => {
  it("builds a finding with whole-design defaults", () => {
    expect(finding({ code: "x-y", severity: "blocker", message: "m", action: "a", whoActs: "owner" })).toEqual({
      code: "x-y", severity: "blocker", article: null, panel: null, message: "m", fix: { action: "a", whoActs: "owner" },
    });
  });

  it("hashes the same findings to the same value in any order", () => {
    const a = finding({ code: "a-a", severity: "warning", message: "m", action: "x", whoActs: "owner" });
    const b = finding({ code: "b-b", severity: "blocker", message: "m", action: "x", whoActs: "factory" });
    expect(findingsHash([a, b])).toBe(findingsHash([b, a]));
    expect(findingsHash([a, b])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes different findings differently", () => {
    const a = finding({ code: "a-a", severity: "warning", message: "m", action: "x", whoActs: "owner" });
    expect(findingsHash([a])).not.toBe(findingsHash([]));
  });

  it("sorts blockers first, then by code", () => {
    const w = finding({ code: "a-a", severity: "warning", message: "m", action: "x", whoActs: "owner" });
    const bl = finding({ code: "z-z", severity: "blocker", message: "m", action: "x", whoActs: "owner" });
    expect(sortFindings([w, bl]).map((f) => f.code)).toEqual(["z-z", "a-a"]);
  });

  it("breaks ties by article, then panel", () => {
    const make = (article: string | null, panel: string | null) =>
      finding({ code: "a-a", severity: "warning", message: "m", action: "x", whoActs: "owner", article, panel });
    const sorted = sortFindings([make("b", null), make("a", "z"), make("a", "y"), make(null, null)]);
    expect(sorted.map((f) => `${f.article ?? ""}/${f.panel ?? ""}`)).toEqual(["/", "a/y", "a/z", "b/"]);
  });
});
