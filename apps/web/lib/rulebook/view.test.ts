import { describe, expect, it } from "vitest";
import { entry } from "./fixtures/entries";
import { inForce } from "./select";
import { DRAFT_LABEL, GAP_TEXT, NEWER_DRAFT_LINE, NOTHING_CONFIRMED_TEXT, statusLabel, whyView } from "./view";

/**
 * Owner decisions 11 and 14. A "Why?" shows the words the factory has confirmed, says who reviewed them and when,
 * and says when a newer draft is waiting without showing it. The Knitwright team sees the draft, marked draft.
 */

const reviewed = {
  status: "confirmed" as const,
  confirmedAt: "2026-11-03T09:30:00Z",
  confirmedName: "Ana Lima",
  confirmedRole: "pattern master",
};

const versions = [entry({ version: 1, ...reviewed }), entry({ version: 2, rule: "Version two, a draft" })];
const why = (reader: "member" | "ops", rows = versions) => whyView("R-SUB-004", inForce(rows, reader));

describe("whyView for a member", () => {
  it("shows the confirmed words, who reviewed them, how far the rule reaches and where it came from", () => {
    expect(why("member", [versions[0]!])).toEqual({
      kind: "rule",
      ruleId: "R-SUB-004",
      version: 1,
      title: "Seam crossings",
      rule: entry().rule,
      body: entry().body,
      bestPractice: entry().bestPractice,
      scope: "the sublimation method (scope not reviewed by a factory)",
      source: "Industry standard or practice: Sublimation practice",
      status: "Reviewed by Ana Lima, pattern master, on 2026-11-03",
      draft: false,
      newerDraft: null,
    });
  });

  it("says a newer draft is waiting, and never shows the draft's words", () => {
    const view = why("member");
    expect(view).toMatchObject({ version: 1, rule: entry().rule, newerDraft: NEWER_DRAFT_LINE, draft: false });
    expect(JSON.stringify(view)).not.toContain("Version two");
  });

  it("shows no words at all when no version has been confirmed", () => {
    expect(why("member", [versions[1]!])).toEqual({ kind: "unconfirmed", ruleId: "R-SUB-004", text: NOTHING_CONFIRMED_TEXT });
    expect(NOTHING_CONFIRMED_TEXT).toContain(DRAFT_LABEL);
  });
});

describe("whyView for the Knitwright team", () => {
  it("shows the newest version, marked draft, with no line about a draft they are reading", () => {
    expect(why("ops")).toMatchObject({ version: 2, rule: "Version two, a draft", status: DRAFT_LABEL, draft: true, newerDraft: null });
  });

  it("shows a confirmed version the same way a member sees it", () => {
    expect(why("ops", [versions[0]!])).toMatchObject({ version: 1, status: "Reviewed by Ana Lima, pattern master, on 2026-11-03" });
  });
});

describe("whyView with no rule behind the id", () => {
  it("shows the gap text, and nothing made up, for an id with no entry", () => {
    for (const reader of ["member", "ops"] as const) {
      expect(why(reader, [])).toEqual({ kind: "gap", ruleId: "R-SUB-004", text: GAP_TEXT });
    }
  });

  it("shows R-GAP-000 as a gap with its own words", () => {
    const gap = entry({ ruleId: "R-GAP-000", body: "No rule written yet; the team has been told" });
    expect(whyView("R-GAP-000", inForce([gap], "ops"))).toEqual({ kind: "gap", ruleId: "R-GAP-000", text: GAP_TEXT });
    expect(whyView("R-GAP-000", inForce([entry({ ruleId: "R-GAP-000", body: "" })], "ops"))).toMatchObject({ text: GAP_TEXT });
  });

  it("names the source alone when there is no note", () => {
    const plain = entry({ ruleId: "R-XX-001", source: "supplier", sourceNote: "", ...reviewed });
    expect(whyView("R-XX-001", inForce([plain], "member"))).toMatchObject({ source: "A supplier" });
  });
});

describe("statusLabel", () => {
  it("reads as a draft unless a person and a date are on the record (owner decision 14)", () => {
    expect(statusLabel({ status: "draft", confirmedAt: null, confirmedName: null, confirmedRole: null })).toBe(DRAFT_LABEL);
    expect(statusLabel({ ...reviewed, confirmedAt: null })).toBe(DRAFT_LABEL);
    expect(statusLabel({ ...reviewed, confirmedName: null })).toBe(DRAFT_LABEL);
    expect(statusLabel({ ...reviewed, confirmedRole: null })).toBe(DRAFT_LABEL);
    expect(statusLabel(reviewed)).toBe("Reviewed by Ana Lima, pattern master, on 2026-11-03");
  });
});
