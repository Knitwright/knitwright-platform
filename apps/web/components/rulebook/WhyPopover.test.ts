import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { whyView } from "@/lib/rulebook/view";
import { entry } from "@/lib/rulebook/fixtures/entries";
import { whyButtonProps, whyPanelProps } from "./a11y";
import { WhyCard } from "./WhyCard";
import { WhyPopover } from "./WhyPopover";

/**
 * Decision 0067: the "Why?" popover's accessibility. The button names the rule it explains and says whether its popover
 * is open and which element it controls; the popover is a non-modal dialog labelled by the rule's heading, and takes
 * focus. The keyboard behaviour (Escape closes and gives focus back) is in e2e/rulebook.spec.ts.
 */

const ids = { ruleId: "R-SUB-004", panelId: "p1", headingId: "h1" };

describe("the Why? button and popover attributes", () => {
  it("names the rule and tells a screen reader what the button opens", () => {
    expect(whyButtonProps(ids, false)).toEqual({
      type: "button",
      "aria-label": "Why? Rulebook R-SUB-004",
      "aria-haspopup": "dialog",
      "aria-expanded": false,
      "aria-controls": "p1",
    });
    expect(whyButtonProps(ids, true)["aria-expanded"]).toBe(true);
  });

  it("labels the popover by its heading and can take focus", () => {
    expect(whyPanelProps(ids, true)).toEqual({ id: "p1", role: "dialog", "aria-modal": false, "aria-labelledby": "h1", "aria-busy": true, tabIndex: -1 });
  });
});

describe("the closed popover", () => {
  it("shows only the button, with the visible text inside its accessible name", () => {
    const html = renderToStaticMarkup(createElement(WhyPopover, { ruleId: "R-SUB-004", explain: async () => ({ success: true as const, data: whyView("R-SUB-004", null) }) }));
    expect(html).toContain('aria-label="Why? Rulebook R-SUB-004"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain(">Why?</button>");
    expect(html).not.toContain('role="dialog"');
  });
});

describe("the card", () => {
  const render = (view: ReturnType<typeof whyView>) => renderToStaticMarkup(createElement(WhyCard, { view, headingId: "h1" }));

  it("gives the heading the id the popover is labelled by, and shows every part of a rule", () => {
    const html = render(whyView("R-SUB-004", entry()));
    expect(html).toContain('id="h1"');
    expect(html).toContain("Rulebook R-SUB-004");
    expect(html).toContain("Seam crossings");
    expect(html).toContain("Each panel is printed and cut separately");
    expect(html).toContain("Best practice:");
    expect(html).toContain("Source: Industry standard or practice: Sublimation practice");
    expect(html).toContain("Draft, not yet confirmed by the factory (version 1)");
  });

  it("leaves the best practice line out when there is none", () => {
    expect(render(whyView("R-SUB-004", entry({ bestPractice: "" })))).not.toContain("Best practice:");
  });

  it("shows only the gap text for an unknown id, still labelled", () => {
    const html = render(whyView("R-NONE-999", null));
    expect(html).toContain('id="h1"');
    expect(html).toContain("No rule written yet; the team has been told");
    expect(html).not.toContain("Source:");
  });
});
