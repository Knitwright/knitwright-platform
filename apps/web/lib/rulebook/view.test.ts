import { describe, expect, it } from "vitest";
import { entry } from "./fixtures/entries";
import { DRAFT_LABEL, GAP_TEXT, statusLabel, whyView } from "./view";

describe("whyView", () => {
  it("shows a draft rule's words, its source and that the factory has not confirmed it", () => {
    expect(whyView("R-SUB-004", entry())).toEqual({
      kind: "rule",
      ruleId: "R-SUB-004",
      version: 1,
      title: "Seam crossings",
      rule: entry().rule,
      body: entry().body,
      bestPractice: entry().bestPractice,
      source: "Industry standard or practice: Sublimation practice",
      status: "Draft, not yet confirmed by the factory",
      draft: true,
    });
  });

  it("says when the factory confirmed a rule", () => {
    const view = whyView("R-SUB-004", entry({ status: "confirmed", confirmedAt: "2026-11-03T09:30:00Z" }));
    expect(view).toMatchObject({ status: "Confirmed by the factory on 2026-11-03", draft: false });
  });

  it("names the source alone when there is no note", () => {
    expect(whyView("R-X-001", entry({ ruleId: "R-XX-001", source: "factory", sourceNote: "" }))).toMatchObject({ source: "The factory" });
  });

  it("shows the gap text, and nothing made up, for an id with no entry", () => {
    expect(whyView("R-NONE-999", null)).toEqual({ kind: "gap", ruleId: "R-NONE-999", text: GAP_TEXT });
  });

  it("shows R-GAP-000 as a gap with its own words", () => {
    expect(whyView("R-GAP-000", entry({ ruleId: "R-GAP-000", body: "No rule written yet; the team has been told" }))).toEqual({
      kind: "gap",
      ruleId: "R-GAP-000",
      text: GAP_TEXT,
    });
    expect(whyView("R-GAP-000", entry({ ruleId: "R-GAP-000", body: "" }))).toMatchObject({ text: GAP_TEXT });
  });
});

describe("statusLabel", () => {
  it("reads as a draft unless confirmed with a date", () => {
    expect(statusLabel({ status: "draft", confirmedAt: null })).toBe(DRAFT_LABEL);
    expect(statusLabel({ status: "confirmed", confirmedAt: null })).toBe(DRAFT_LABEL);
  });
});
