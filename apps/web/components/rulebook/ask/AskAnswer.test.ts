import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { askRulebook, type AskDeps } from "@/lib/rulebook/ask/ask";
import { bestPracticeCard, partFor } from "@/lib/rulebook/ask/best-practice";
import { DESIGN } from "@/lib/rulebook/ask/fixtures/questions";
import { DRAFT_RULES, REVIEWED_RULES } from "@/lib/rulebook/ask/fixtures/rules";
import { fixtureRetrieval } from "@/lib/rulebook/ask/fixtures/search";
import { stubModel } from "@/lib/rulebook/ask/fixtures/stub";
import { NOT_COVERED, UNGROUNDED } from "@/lib/rulebook/ask/grader";
import { NEWER_DRAFT_LINE } from "@/lib/rulebook/view";
import { askBoxProps, bestPracticeProps } from "./a11y";
import { AskAnswer } from "./AskAnswer";
import { BestPracticeCard } from "./BestPracticeCard";

/**
 * What the Ask box and the best-practice card put on the page (decision 0083). The reading that matters is the
 * last one: a sentence the grader turned down never reaches the page at all, not even to be explained.
 */

const SEAM = "How far from a seam should a crest sit?";

/** React escapes an apostrophe in rendered text, so the fixed sentences are compared as the page holds them. */
const asRendered = (text: string): string => text.replace(/'/g, "&#x27;");

const deps = (model: AskDeps["model"], rules = REVIEWED_RULES, reader: AskDeps["reader"] = "member"): AskDeps => ({
  retrieval: fixtureRetrieval(rules),
  logGap: async () => undefined,
  model,
  reader,
});

const answer = (model: AskDeps["model"], rules = REVIEWED_RULES, question = SEAM) =>
  askRulebook(deps(model, rules), { question, scope: DESIGN });

const render = async (model: AskDeps["model"], rules = REVIEWED_RULES, question = SEAM) =>
  renderToStaticMarkup(createElement(AskAnswer, { result: await answer(model, rules, question) }));

describe("the Ask box's attributes", () => {
  it("names the box by its heading and reads the answer out when it arrives", () => {
    const props = askBoxProps(true);
    expect(props.answerProps).toEqual({ role: "status", "aria-live": "polite", "aria-busy": true, "data-testid": "ask-result" });
    expect(askBoxProps(false).answerProps["aria-busy"]).toBe(false);
    expect(props.headingId).toBe("ask-rulebook-heading");
  });

  it("names a best-practice card after the part it is about", () => {
    expect(bestPracticeProps("collar", "Collar and neck")).toEqual({
      role: "group",
      "aria-label": "Best practice: Collar and neck",
      "data-testid": "best-practice-collar",
    });
  });
});

describe("an answer on the page", () => {
  it("shows each sentence with the Why? link of the rule it cites", async () => {
    const html = await render(stubModel());
    expect(html).toContain('data-testid="ask-answer"');
    expect(html).toContain('aria-label="Why? Rulebook R-SUB-004"');
    expect(html).toContain("Artwork that crosses a seam");
  });

  it("shows the rules the search found beside the answer, in the rulebook's own words", async () => {
    const html = await render(stubModel());
    expect(html).toContain('data-testid="ask-rules"');
    expect(html).toContain("Rulebook R-SUB-004");
    expect(html).toContain("Covers: the sublimation method (scope not reviewed by a factory)");
  });
});

describe("an answer the grader turned down", () => {
  it("shows the rules and the plain line, and not one word the model wrote", async () => {
    const html = await render(stubModel({ flaw: "uncited" }));
    expect(html).toContain('data-testid="ask-ungrounded"');
    expect(html).toContain(asRendered(UNGROUNDED));
    expect(html).not.toContain("Flatlock seams are always softer");
    expect(html).toContain('data-testid="ask-rules"');
  });

  it("shows nothing a model wrote when an invented measurement was the reason", async () => {
    const html = await render(stubModel({ flaw: "invented_measurement" }));
    expect(html).not.toContain("42 mm");
  });
});

describe("a question nothing covers", () => {
  it("says so and offers the Why? of R-GAP-000", async () => {
    const html = await render(stubModel(), REVIEWED_RULES, "Do you ship to Canada?");
    expect(html).toContain('data-testid="ask-not-covered"');
    expect(html).toContain(asRendered(NOT_COVERED));
    expect(html).toContain('aria-label="Why? Rulebook R-GAP-000"');
  });

  it("says so to a member while every rule is still a draft, and shows no draft's words", async () => {
    const html = await render(stubModel(), DRAFT_RULES);
    expect(html).toContain('data-testid="ask-not-covered"');
    expect(html).not.toContain("Artwork that crosses a seam");
  });
});

describe("the best-practice card on the page", () => {
  const card = (rules = REVIEWED_RULES) => bestPracticeCard(rules, partFor("collar")!, DESIGN);
  const draw = (rules = REVIEWED_RULES) => renderToStaticMarkup(createElement(BestPracticeCard, { card: card(rules) }));

  it("shows the rulebook's own best practice with the rule's Why? beside it", () => {
    const html = draw();
    expect(html).toContain('data-testid="best-practice-collar"');
    expect(html).toContain("Best practice · Collar and neck");
    expect(html).toMatch(/aria-label="Why\? Rulebook R-(CON|PAT|FIT)-\d{3}"/);
  });

  it("says plainly that nothing is written yet, with R-GAP-000, rather than filling the space", () => {
    const html = draw(DRAFT_RULES);
    expect(html).toContain(asRendered("Knitwright's rulebook has no best practice written for collar and neck yet."));
    expect(html).toContain('aria-label="Why? Rulebook R-GAP-000"');
  });

  it("says a newer draft is waiting without showing it", () => {
    const signed = REVIEWED_RULES.find((rule) => rule.ruleId === "R-CON-004")!;
    const shown = bestPracticeCard(
      [signed, { ...signed, version: 2, status: "draft", confirmedAt: null, confirmedName: null, confirmedRole: null, bestPractice: "Newer draft advice" }],
      partFor("collar")!,
      DESIGN,
    );
    const html = renderToStaticMarkup(createElement(BestPracticeCard, { card: shown }));
    expect(html).toContain(NEWER_DRAFT_LINE);
    expect(html).not.toContain("Newer draft advice");
  });
});
