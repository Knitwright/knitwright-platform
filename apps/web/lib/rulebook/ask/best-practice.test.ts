import { describe, expect, it } from "vitest";
import { GAP_RULE_ID } from "../constants";
import { entry } from "../fixtures/entries";
import { SUBLIMATION, type ScopeAsk } from "../scope";
import { NEWER_DRAFT_LINE } from "../view";
import { aboutPart, bestPracticeCard, MAX_LINES, PARTS, partFor } from "./best-practice";
import { DRAFT_RULES, REVIEWED_RULES, ruleOf } from "./fixtures/rules";

/**
 * The best-practice card shown when a part is selected (spec F-S5 v2). Every line on it is the rulebook's own
 * "Best practice" column, word for word, with the id it came from. Nothing is written for a part the rulebook
 * says nothing about: the card says so and carries R-GAP-000.
 */

const DESIGN: ScopeAsk = { articleCode: "JSY-SS-01", method: SUBLIMATION };

const card = (key: string, ask: ScopeAsk = DESIGN, entries = REVIEWED_RULES, reader: "member" | "ops" = "member") => {
  const part = partFor(key);
  if (!part) throw new Error(`no part ${key}`);
  return bestPracticeCard(entries, part, ask, reader);
};

describe("the parts a card can be asked for", () => {
  it("are data, each with the topics and the words the rulebook names it by", () => {
    expect(PARTS.map((part) => part.key)).toEqual(["collar", "sleeve", "body", "artwork", "names", "labels"]);
    expect(PARTS.every((part) => part.topics.length > 0 && part.words.length > 0)).toBe(true);
    expect(partFor("nothing-like-this")).toBeNull();
  });

  it("match a rule by its topic and by the words of its own applies-to line", () => {
    const collar = partFor("collar");
    const artwork = partFor("artwork");
    if (!collar || !artwork) throw new Error("missing part");
    expect(aboutPart(ruleOf(REVIEWED_RULES, "R-CON-004"), collar)).toBe(true);
    expect(aboutPart(ruleOf(REVIEWED_RULES, "R-CON-004"), artwork)).toBe(false);
    expect(aboutPart(entry({ topic: null }), artwork)).toBe(false);
  });
});

describe("a card for a part the rulebook covers", () => {
  it("shows the rulebook's own best-practice words, with the rule each came from", () => {
    const shown = card("collar");
    expect(shown.kind).toBe("lines");
    if (shown.kind !== "lines") return;
    expect(shown.label).toBe("Collar and neck");
    expect(shown.lines.length).toBeGreaterThan(0);
    expect(shown.lines.length).toBeLessThanOrEqual(MAX_LINES);
    for (const line of shown.lines) {
      expect(line.text).toBe(ruleOf(REVIEWED_RULES, line.ruleId).bestPractice);
      expect(line.ruleId).toMatch(/^R-[A-Z]{2,8}-\d{3}$/);
    }
  });

  it("shows something for every part the rulebook was written for", () => {
    for (const part of PARTS) expect(card(part.key).kind, part.key).toBe("lines");
  });

  it("gives a print rule to a design made by sublimation and not to one that is not", () => {
    expect(card("artwork", { articleCode: "JSY-SS-01", method: SUBLIMATION }).kind).toBe("lines");
    expect(card("artwork", { articleCode: "JSY-SS-01" }).kind).toBe("none");
  });
});

describe("a card a member may not be shown", () => {
  it("says nothing while the rules behind it are drafts, and carries R-GAP-000", () => {
    const shown = card("collar", DESIGN, DRAFT_RULES);
    expect(shown.kind).toBe("none");
    if (shown.kind !== "none") return;
    expect(shown.ruleId).toBe(GAP_RULE_ID);
    expect(shown.message).toBe("Knitwright's rulebook has no best practice written for collar and neck yet.");
  });

  it("shows the Knitwright team those same drafts", () => {
    expect(card("collar", DESIGN, DRAFT_RULES, "ops").kind).toBe("lines");
  });

  it("says a newer draft is waiting without showing a word of it", () => {
    const signed = ruleOf(REVIEWED_RULES, "R-CON-004");
    const shown = bestPracticeCard(
      [signed, { ...signed, version: 2, status: "draft", confirmedAt: null, confirmedName: null, confirmedRole: null, bestPractice: "Newer draft advice" }],
      partFor("collar")!,
      DESIGN,
    );
    expect(shown.kind).toBe("lines");
    if (shown.kind !== "lines") return;
    expect(shown.lines[0].text).toBe(signed.bestPractice);
    expect(shown.lines[0].newerDraft).toBe(NEWER_DRAFT_LINE);
    expect(JSON.stringify(shown)).not.toContain("Newer draft advice");
  });

  it("says nothing rather than something for a rule whose best-practice column is empty", () => {
    const blank = { ...ruleOf(REVIEWED_RULES, "R-CON-004"), bestPractice: "" };
    expect(bestPracticeCard([blank], partFor("collar")!, DESIGN).kind).toBe("none");
  });
});
