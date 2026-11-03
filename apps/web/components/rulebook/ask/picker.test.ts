import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bestPracticeCard, PARTS, partFor } from "@/lib/rulebook/ask/best-practice";
import { REVIEWED_RULES } from "@/lib/rulebook/ask/fixtures/rules";
import { bestPracticePickerProps } from "./a11y";
import { BestPracticeCard } from "./BestPracticeCard";
import { partChoices } from "./picker";

/**
 * The door the best-practice card did not have (decision 0117 owner question 1, answered: a part chooser beside
 * the Ask box). The card and `bestPracticeAction` were built, tested and reachable by nobody, because spec
 * F-S5 v2 asks for the card "when a part is selected" and nothing selected one of the rulebook's six parts.
 *
 * What is tested here is the part that can be: the list the picker offers, and that it offers exactly the keys
 * the action accepts. The component itself is a form around `useFormAction`, the same shape as the Ask box.
 */

const card = (part: string) => {
  const definition = partFor(part);
  if (definition === null) throw new Error(`no part ${part}`);
  return bestPracticeCard(REVIEWED_RULES, definition, {}, "member");
};

describe("the parts a person may choose", () => {
  it("offers every part the rulebook defines, in the rulebook's own order", () => {
    expect(partChoices(null).map((choice) => choice.key)).toEqual(PARTS.map((part) => part.key));
    expect(partChoices(null).map((choice) => choice.label)).toEqual(PARTS.map((part) => part.label));
  });

  it("offers only parts the action would accept, so the picker cannot ask for one it refuses", () => {
    for (const choice of partChoices(null)) expect(partFor(choice.key)).not.toBeNull();
  });

  it("marks none until a card is on the screen, then the one the card is about", () => {
    expect(partChoices(null).some((choice) => choice.chosen)).toBe(false);
    const chosen = partChoices(card("collar")).filter((choice) => choice.chosen);
    expect(chosen.map((choice) => choice.key)).toEqual(["collar"]);
  });
});

describe("the picker's attributes", () => {
  it("names the group by its heading and reads the card out when it arrives", () => {
    const props = bestPracticePickerProps(true);
    expect(props.groupProps).toEqual({ role: "group", "aria-labelledby": "best-practice-heading" });
    expect(props.cardProps).toEqual({
      role: "status",
      "aria-live": "polite",
      "aria-busy": true,
      "data-testid": "best-practice-result",
    });
    expect(bestPracticePickerProps(false).cardProps["aria-busy"]).toBe(false);
  });

  it("says nothing untrue about what a part button does: no pressed state on a submit", () => {
    expect(JSON.stringify(bestPracticePickerProps(false))).not.toContain("aria-pressed");
  });
});

describe("the card the chooser reaches", () => {
  it("is the rulebook's own best practice for that part, with the rule behind each line", () => {
    const markup = renderToStaticMarkup(createElement(BestPracticeCard, { card: card("artwork") }));
    expect(markup).toContain("Best practice ·");
    expect(markup).toMatch(/R-[A-Z]+-[0-9]{3}/);
  });
});
